-- ============================================================================
-- Recordatorios recurrentes
-- ============================================================================

-- ===== Ampliación del modelo de recordatorios =====

alter table public.reminders
  add column repeat_interval_days smallint,
  add constraint reminders_repeat_interval_allowed
    check (repeat_interval_days is null or repeat_interval_days in (1, 7));

-- ===== Identificación única de cada envío =====

alter table public.notifications add column occurrence_at timestamptz;

update public.notifications
set occurrence_at = created_at
where occurrence_at is null;

alter table public.notifications
  alter column occurrence_at set not null,
  drop constraint notifications_reminder_recipient_unique,
  add constraint notifications_reminder_recipient_occurrence_unique
    unique (reminder_id, recipient_user_id, occurrence_at);

-- ===== Procesamiento inmediato por familia =====

create or replace function public.notify_due_reminders_for_family(
  target_family_id uuid,
  batch_size integer default 100
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  due_reminder record;
  processed_count integer := 0;
begin
  -- ===== Consulta y bloqueo de recordatorios vencidos =====

  for due_reminder in
    select
      reminder.id,
      reminder.scheduled_for,
      reminder.repeat_interval_days,
      family.owner_user_id,
      document.name as document_name,
      document.expiration_date
    from public.reminders as reminder
    join public.documents as document
      on document.family_id = reminder.family_id and document.id = reminder.document_id
    join public.properties as property
      on property.family_id = document.family_id and property.id = document.property_id
    join public.families as family on family.id = reminder.family_id
    where reminder.family_id = target_family_id
      and (
        reminder.status = 'scheduled'
        or (reminder.status = 'notified' and reminder.repeat_interval_days is not null)
      )
      and reminder.scheduled_for <= statement_timestamp()
      and document.status = 'active'
      and property.status = 'active'
    order by reminder.scheduled_for
    for update of reminder skip locked
    limit batch_size
  loop
    -- ===== Creación idempotente de la notificación =====

    insert into public.notifications (
      family_id, reminder_id, recipient_user_id, title, message, occurrence_at
    ) values (
      target_family_id,
      due_reminder.id,
      due_reminder.owner_user_id,
      left('Revisa: ' || due_reminder.document_name, 200),
      left(
        format(
          'El documento “%s” tiene vencimiento el %s.',
          due_reminder.document_name,
          to_char(due_reminder.expiration_date, 'DD/MM/YYYY')
        ),
        500
      ),
      due_reminder.scheduled_for
    ) on conflict (reminder_id, recipient_user_id, occurrence_at) do nothing;

    -- ===== Programación de la siguiente repetición =====

    update public.reminders
    set status = 'notified',
        notified_at = coalesce(notified_at, statement_timestamp()),
        scheduled_for = case
          when repeat_interval_days is null then scheduled_for
          else statement_timestamp() + make_interval(days => repeat_interval_days::integer)
        end,
        updated_by_user_id = due_reminder.owner_user_id
    where id = due_reminder.id
      and (status = 'scheduled' or (status = 'notified' and repeat_interval_days is not null));

    processed_count := processed_count + 1;
  end loop;

  -- ===== Retorno del resultado =====

  return processed_count;
end;
$$;

-- ===== Creación de recordatorios =====

drop function if exists public.create_reminder(uuid, uuid, smallint);

create function public.create_reminder(
  reminder_id uuid,
  target_document_id uuid,
  reminder_lead_days smallint,
  reminder_repeat_interval_days smallint default null
)
returns public.reminders
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  document_record public.documents;
  family_timezone text;
  created_reminder public.reminders;
  existing_reminder public.reminders;
begin
  -- ===== Validación de la frecuencia =====

  if reminder_repeat_interval_days is not null and reminder_repeat_interval_days not in (1, 7) then
    raise exception using errcode = '22023', message = 'La frecuencia debe ser diaria, semanal o sin repetición.';
  end if;

  -- ===== Consulta del documento autorizado =====

  select document.*
  into document_record
  from public.documents as document
  join public.properties as property
    on property.family_id = document.family_id and property.id = document.property_id
  join public.families as family on family.id = document.family_id
  where document.id = target_document_id
    and family.owner_user_id = current_user_id
    and document.status = 'active'
    and property.status = 'active'
    and document.expiration_date is not null;

  if document_record.id is null then
    raise exception using errcode = 'P0002', message = 'El documento no existe, está archivado o no tiene vencimiento.';
  end if;

  -- ===== Validación de idempotencia =====

  select timezone into family_timezone from public.families where id = document_record.family_id;
  select * into existing_reminder from public.reminders where id = reminder_id;

  if existing_reminder.id is not null then
    if existing_reminder.document_id = target_document_id
      and existing_reminder.family_id = document_record.family_id
      and existing_reminder.lead_days = reminder_lead_days
      and existing_reminder.repeat_interval_days is not distinct from reminder_repeat_interval_days then
      return existing_reminder;
    end if;
    raise exception using errcode = '23505', message = 'El identificador del recordatorio ya está en uso.';
  end if;

  -- ===== Persistencia del recordatorio =====

  insert into public.reminders (
    id, family_id, document_id, lead_days, repeat_interval_days, scheduled_for,
    created_by_user_id, updated_by_user_id
  ) values (
    reminder_id, document_record.family_id, document_record.id, reminder_lead_days,
    reminder_repeat_interval_days,
    public.calculate_reminder_time(document_record.expiration_date, reminder_lead_days, family_timezone),
    current_user_id, current_user_id
  ) returning * into created_reminder;

  -- ===== Procesamiento inmediato cuando el aviso ya venció =====

  perform public.notify_due_reminders_for_family(document_record.family_id, 1);
  select * into created_reminder from public.reminders where id = reminder_id;
  return created_reminder;
end;
$$;

-- ===== Actualización de recordatorios =====

drop function if exists public.update_reminder(uuid, smallint, bigint);

create function public.update_reminder(
  target_reminder_id uuid,
  reminder_lead_days smallint,
  expected_version bigint,
  reminder_repeat_interval_days smallint default null
)
returns public.reminders
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  updated_reminder public.reminders;
begin
  -- ===== Validación de la frecuencia =====

  if reminder_repeat_interval_days is not null and reminder_repeat_interval_days not in (1, 7) then
    raise exception using errcode = '22023', message = 'La frecuencia debe ser diaria, semanal o sin repetición.';
  end if;

  -- ===== Actualización con control de versión y permisos =====

  update public.reminders as reminder
  set lead_days = reminder_lead_days,
      repeat_interval_days = reminder_repeat_interval_days,
      scheduled_for = public.calculate_reminder_time(
        document.expiration_date, reminder_lead_days, family.timezone
      ),
      updated_by_user_id = current_user_id
  from public.documents as document, public.properties as property, public.families as family
  where reminder.id = target_reminder_id
    and reminder.document_id = document.id
    and reminder.family_id = document.family_id
    and document.property_id = property.id
    and document.family_id = property.family_id
    and document.family_id = family.id
    and family.owner_user_id = current_user_id
    and reminder.status = 'scheduled'
    and document.status = 'active'
    and property.status = 'active'
    and document.expiration_date is not null
    and reminder.version = expected_version
  returning reminder.* into updated_reminder;

  if updated_reminder.id is null then
    raise exception using errcode = 'P0002', message = 'El recordatorio no existe, no está programado o cambió en otra sesión.';
  end if;

  -- ===== Procesamiento inmediato cuando el nuevo horario ya venció =====

  perform public.notify_due_reminders_for_family(updated_reminder.family_id, 1);
  select * into updated_reminder from public.reminders where id = target_reminder_id;
  return updated_reminder;
end;
$$;

-- ===== Procesamiento programado de recordatorios =====

create or replace function public.process_due_reminders(batch_size integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  due_reminder record;
  processed_count integer := 0;
begin
  -- ===== Validación de autorización y lote =====

  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'La operación requiere el proceso de recordatorios.';
  end if;
  if batch_size < 1 or batch_size > 500 then
    raise exception using errcode = '22023', message = 'El tamaño de lote debe estar entre 1 y 500.';
  end if;

  -- ===== Consulta y bloqueo de recordatorios vencidos =====

  for due_reminder in
    select reminder.id, reminder.family_id, reminder.scheduled_for,
      reminder.repeat_interval_days, family.owner_user_id,
      document.name as document_name, document.expiration_date
    from public.reminders as reminder
    join public.documents as document
      on document.family_id = reminder.family_id and document.id = reminder.document_id
    join public.properties as property
      on property.family_id = document.family_id and property.id = document.property_id
    join public.families as family on family.id = reminder.family_id
    where (reminder.status = 'scheduled'
      or (reminder.status = 'notified' and reminder.repeat_interval_days is not null))
      and reminder.scheduled_for <= statement_timestamp()
      and document.status = 'active'
      and property.status = 'active'
    order by reminder.scheduled_for
    for update of reminder skip locked
    limit batch_size
  loop
    -- ===== Creación idempotente de la notificación =====

    insert into public.notifications (
      family_id, reminder_id, recipient_user_id, title, message, occurrence_at
    ) values (
      due_reminder.family_id, due_reminder.id, due_reminder.owner_user_id,
      left('Revisa: ' || due_reminder.document_name, 200),
      left(format('El documento “%s” tiene vencimiento el %s.', due_reminder.document_name,
        to_char(due_reminder.expiration_date, 'DD/MM/YYYY')), 500),
      due_reminder.scheduled_for
    ) on conflict (reminder_id, recipient_user_id, occurrence_at) do nothing;

    -- ===== Programación de la siguiente repetición =====

    update public.reminders
    set status = 'notified',
        notified_at = coalesce(notified_at, statement_timestamp()),
        scheduled_for = case when repeat_interval_days is null then scheduled_for
          else statement_timestamp() + make_interval(days => repeat_interval_days::integer) end,
        updated_by_user_id = due_reminder.owner_user_id
    where id = due_reminder.id
      and (status = 'scheduled' or (status = 'notified' and repeat_interval_days is not null));
    processed_count := processed_count + 1;
  end loop;

  -- ===== Retorno del resultado =====

  return processed_count;
end;
$$;

-- ===== Permisos de ejecución =====

revoke all on function public.create_reminder(uuid, uuid, smallint, smallint) from public, anon, authenticated;
revoke all on function public.update_reminder(uuid, smallint, bigint, smallint) from public, anon, authenticated;
grant execute on function public.create_reminder(uuid, uuid, smallint, smallint) to authenticated;
grant execute on function public.update_reminder(uuid, smallint, bigint, smallint) to authenticated;
