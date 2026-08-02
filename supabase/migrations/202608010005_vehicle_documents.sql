-- ============================================================================
-- Documentos asociados con vehículos
-- ============================================================================

-- ===== Relación explícita con el recurso propietario =====

alter table public.documents
  alter column property_id drop not null,
  add column vehicle_id uuid,
  add constraint documents_vehicle_fk foreign key (family_id, vehicle_id)
    references public.vehicles (family_id, id) on delete restrict,
  add constraint documents_single_parent check (
    (property_id is not null and vehicle_id is null)
    or (property_id is null and vehicle_id is not null)
  );

alter table public.documents drop constraint documents_category_allowed;

alter table public.documents add constraint documents_category_allowed check (category in (
  'deed', 'contract', 'insurance_policy', 'property_tax_receipt', 'appraisal',
  'plan', 'warranty', 'invoice', 'permit', 'registration_card', 'inspection',
  'financing', 'manual', 'other'
));

create index documents_family_vehicle_status_name_idx
  on public.documents (family_id, vehicle_id, status, name, id)
  where vehicle_id is not null;

-- ===== Validación compartida del recurso propietario =====

create function public.is_active_document_parent(
  target_family_id uuid,
  target_property_id uuid,
  target_vehicle_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      target_property_id is not null
      and target_vehicle_id is null
      and exists (
        select 1 from public.properties
        where id = target_property_id
          and family_id = target_family_id
          and status = 'active'
      )
    )
    or
    (
      target_property_id is null
      and target_vehicle_id is not null
      and exists (
        select 1 from public.vehicles
        where id = target_vehicle_id
          and family_id = target_family_id
          and status = 'active'
      )
    );
$$;

revoke all on function public.is_active_document_parent(uuid, uuid, uuid)
  from public, anon, authenticated;

-- ===== Finalización segura de documentos vehiculares =====

create function public.finalize_vehicle_document_upload(
  actor_user_id uuid,
  document_id uuid,
  file_id uuid,
  target_family_id uuid,
  target_vehicle_id uuid,
  document_name text,
  document_category text,
  document_issue_date date,
  document_expiration_date date,
  document_issuer text,
  document_number_value text,
  document_notes text,
  file_storage_key text,
  file_original_filename text,
  file_detected_mime_type text,
  file_size_bytes bigint,
  file_sha256 text
)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_document public.documents;
  existing_document public.documents;
  expected_storage_key text;
begin
  -- ===== Autorización del proceso y recurso =====

  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'La operación requiere el proceso seguro de archivos.';
  end if;

  if not exists (
    select 1 from public.families
    where id = target_family_id and owner_user_id = actor_user_id
  ) or not public.is_active_document_parent(target_family_id, null, target_vehicle_id) then
    raise exception using errcode = 'P0002', message = 'El vehículo no existe o está archivado.';
  end if;

  -- ===== Validación de ubicación e idempotencia =====

  expected_storage_key := format(
    'families/%s/documents/%s/files/%s',
    target_family_id,
    document_id,
    file_id
  );

  if file_storage_key <> expected_storage_key then
    raise exception using errcode = '22023', message = 'La ubicación del archivo no es válida.';
  end if;

  select * into existing_document from public.documents where id = document_id;

  if existing_document.id is not null then
    if existing_document.family_id = target_family_id
      and existing_document.vehicle_id = target_vehicle_id
      and existing_document.created_by_user_id = actor_user_id
      and exists (
        select 1 from public.document_files
        where id = file_id
          and document_files.document_id = existing_document.id
          and storage_key = file_storage_key
          and sha256 = file_sha256
          and status = 'active'
      ) then
      return existing_document;
    end if;

    raise exception using errcode = '23505', message = 'El identificador del documento ya está en uso.';
  end if;

  -- ===== Persistencia del documento y archivo =====

  insert into public.documents (
    id, family_id, vehicle_id, name, category, issue_date, expiration_date,
    issuer, document_number, notes, created_by_user_id, updated_by_user_id
  ) values (
    document_id, target_family_id, target_vehicle_id, trim(document_name),
    document_category, document_issue_date, document_expiration_date,
    nullif(trim(document_issuer), ''), nullif(trim(document_number_value), ''),
    nullif(trim(document_notes), ''), actor_user_id, actor_user_id
  ) returning * into created_document;

  insert into public.document_files (
    id, family_id, document_id, storage_key, original_filename,
    detected_mime_type, size_bytes, sha256, created_by_user_id
  ) values (
    file_id, target_family_id, document_id, file_storage_key,
    trim(file_original_filename), file_detected_mime_type, file_size_bytes,
    lower(file_sha256), actor_user_id
  );

  return created_document;
end;
$$;

-- ===== Actualización documental para ambos recursos =====

create or replace function public.update_document(
  target_document_id uuid,
  document_name text,
  document_category text,
  document_issue_date date,
  document_expiration_date date,
  document_issuer text,
  document_number_value text,
  document_notes text,
  expected_version bigint
)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  updated_document public.documents;
  family_timezone text;
begin
  -- ===== Persistencia con permisos y control de versión =====

  update public.documents as document
  set name = trim(document_name),
      category = document_category,
      issue_date = document_issue_date,
      expiration_date = document_expiration_date,
      issuer = nullif(trim(document_issuer), ''),
      document_number = nullif(trim(document_number_value), ''),
      notes = nullif(trim(document_notes), ''),
      updated_by_user_id = current_user_id
  from public.families as family
  where document.id = target_document_id
    and document.family_id = family.id
    and family.owner_user_id = current_user_id
    and document.status = 'active'
    and public.is_active_document_parent(document.family_id, document.property_id, document.vehicle_id)
    and document.version = expected_version
  returning document.* into updated_document;

  if updated_document.id is null then
    raise exception using errcode = 'P0002', message = 'El documento no existe, está archivado o cambió en otra sesión.';
  end if;

  -- ===== Reprogramación de recordatorios =====

  select timezone into family_timezone from public.families where id = updated_document.family_id;

  if updated_document.expiration_date is null then
    update public.reminders
    set status = 'cancelled', cancelled_at = statement_timestamp(),
        updated_by_user_id = current_user_id
    where document_id = updated_document.id
      and family_id = updated_document.family_id
      and status = 'scheduled';
  else
    update public.reminders
    set scheduled_for = public.calculate_reminder_time(
          updated_document.expiration_date, lead_days, family_timezone
        ),
        updated_by_user_id = current_user_id
    where document_id = updated_document.id
      and family_id = updated_document.family_id
      and status = 'scheduled';
  end if;

  perform public.notify_due_reminders_for_family(updated_document.family_id, 1);
  return updated_document;
end;
$$;

-- ===== Creación de recordatorios para ambos recursos =====

create or replace function public.create_reminder(
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
  -- ===== Validación de frecuencia y documento =====

  if reminder_repeat_interval_days is not null and reminder_repeat_interval_days not in (1, 7) then
    raise exception using errcode = '22023', message = 'La frecuencia debe ser diaria, semanal o sin repetición.';
  end if;

  select document.* into document_record
  from public.documents as document
  join public.families as family on family.id = document.family_id
  where document.id = target_document_id
    and family.owner_user_id = current_user_id
    and document.status = 'active'
    and document.expiration_date is not null
    and public.is_active_document_parent(document.family_id, document.property_id, document.vehicle_id);

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

  -- ===== Persistencia y procesamiento inmediato =====

  insert into public.reminders (
    id, family_id, document_id, lead_days, repeat_interval_days, scheduled_for,
    created_by_user_id, updated_by_user_id
  ) values (
    reminder_id, document_record.family_id, document_record.id,
    reminder_lead_days, reminder_repeat_interval_days,
    public.calculate_reminder_time(document_record.expiration_date, reminder_lead_days, family_timezone),
    current_user_id, current_user_id
  ) returning * into created_reminder;

  perform public.notify_due_reminders_for_family(document_record.family_id, 1);
  select * into created_reminder from public.reminders where id = reminder_id;
  return created_reminder;
end;
$$;

-- ===== Actualización de recordatorios para ambos recursos =====

create or replace function public.update_reminder(
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
  -- ===== Validación de frecuencia =====

  if reminder_repeat_interval_days is not null and reminder_repeat_interval_days not in (1, 7) then
    raise exception using errcode = '22023', message = 'La frecuencia debe ser diaria, semanal o sin repetición.';
  end if;

  -- ===== Persistencia con permisos y control de versión =====

  update public.reminders as reminder
  set lead_days = reminder_lead_days,
      repeat_interval_days = reminder_repeat_interval_days,
      scheduled_for = public.calculate_reminder_time(
        document.expiration_date, reminder_lead_days, family.timezone
      ),
      updated_by_user_id = current_user_id
  from public.documents as document, public.families as family
  where reminder.id = target_reminder_id
    and reminder.document_id = document.id
    and reminder.family_id = document.family_id
    and document.family_id = family.id
    and family.owner_user_id = current_user_id
    and reminder.status = 'scheduled'
    and document.status = 'active'
    and document.expiration_date is not null
    and public.is_active_document_parent(document.family_id, document.property_id, document.vehicle_id)
    and reminder.version = expected_version
  returning reminder.* into updated_reminder;

  if updated_reminder.id is null then
    raise exception using errcode = 'P0002', message = 'El recordatorio no existe, no está programado o cambió en otra sesión.';
  end if;

  perform public.notify_due_reminders_for_family(updated_reminder.family_id, 1);
  select * into updated_reminder from public.reminders where id = target_reminder_id;
  return updated_reminder;
end;
$$;

-- ===== Procesamiento compartido de notificaciones =====

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
  for due_reminder in
    select reminder.id, reminder.scheduled_for, reminder.repeat_interval_days,
      family.owner_user_id, document.name as document_name,
      document.expiration_date
    from public.reminders as reminder
    join public.documents as document
      on document.family_id = reminder.family_id and document.id = reminder.document_id
    join public.families as family on family.id = reminder.family_id
    where reminder.family_id = target_family_id
      and (reminder.status = 'scheduled'
        or (reminder.status = 'notified' and reminder.repeat_interval_days is not null))
      and reminder.scheduled_for <= statement_timestamp()
      and document.status = 'active'
      and public.is_active_document_parent(document.family_id, document.property_id, document.vehicle_id)
    order by reminder.scheduled_for
    for update of reminder skip locked
    limit batch_size
  loop
    insert into public.notifications (
      family_id, reminder_id, recipient_user_id, title, message, occurrence_at
    ) values (
      target_family_id, due_reminder.id, due_reminder.owner_user_id,
      left('Revisa: ' || due_reminder.document_name, 200),
      left(format('El documento “%s” tiene vencimiento el %s.',
        due_reminder.document_name,
        to_char(due_reminder.expiration_date, 'DD/MM/YYYY')), 500),
      due_reminder.scheduled_for
    ) on conflict (reminder_id, recipient_user_id, occurrence_at) do nothing;

    update public.reminders
    set status = 'notified', notified_at = coalesce(notified_at, statement_timestamp()),
        scheduled_for = case when repeat_interval_days is null then scheduled_for
          else statement_timestamp() + make_interval(days => repeat_interval_days::integer) end,
        updated_by_user_id = due_reminder.owner_user_id
    where id = due_reminder.id
      and (status = 'scheduled' or (status = 'notified' and repeat_interval_days is not null));

    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$$;

-- ===== Procesamiento programado compartido =====

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
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'La operación requiere el proceso de recordatorios.';
  end if;
  if batch_size < 1 or batch_size > 500 then
    raise exception using errcode = '22023', message = 'El tamaño de lote debe estar entre 1 y 500.';
  end if;

  for due_reminder in
    select reminder.id, reminder.family_id, reminder.scheduled_for,
      reminder.repeat_interval_days, family.owner_user_id,
      document.name as document_name, document.expiration_date
    from public.reminders as reminder
    join public.documents as document
      on document.family_id = reminder.family_id and document.id = reminder.document_id
    join public.families as family on family.id = reminder.family_id
    where (reminder.status = 'scheduled'
      or (reminder.status = 'notified' and reminder.repeat_interval_days is not null))
      and reminder.scheduled_for <= statement_timestamp()
      and document.status = 'active'
      and public.is_active_document_parent(document.family_id, document.property_id, document.vehicle_id)
    order by reminder.scheduled_for
    for update of reminder skip locked
    limit batch_size
  loop
    insert into public.notifications (
      family_id, reminder_id, recipient_user_id, title, message, occurrence_at
    ) values (
      due_reminder.family_id, due_reminder.id, due_reminder.owner_user_id,
      left('Revisa: ' || due_reminder.document_name, 200),
      left(format('El documento “%s” tiene vencimiento el %s.',
        due_reminder.document_name,
        to_char(due_reminder.expiration_date, 'DD/MM/YYYY')), 500),
      due_reminder.scheduled_for
    ) on conflict (reminder_id, recipient_user_id, occurrence_at) do nothing;

    update public.reminders
    set status = 'notified', notified_at = coalesce(notified_at, statement_timestamp()),
        scheduled_for = case when repeat_interval_days is null then scheduled_for
          else statement_timestamp() + make_interval(days => repeat_interval_days::integer) end,
        updated_by_user_id = due_reminder.owner_user_id
    where id = due_reminder.id
      and (status = 'scheduled' or (status = 'notified' and repeat_interval_days is not null));

    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$$;

-- ===== Archivado vehicular con cancelación de avisos =====

create or replace function public.set_vehicle_archived(
  target_vehicle_id uuid,
  archive boolean,
  expected_version bigint
)
returns public.vehicles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  updated_vehicle public.vehicles;
begin
  update public.vehicles as vehicle
  set status = case when archive then 'archived' else 'active' end,
      archived_at = case when archive then statement_timestamp() else null end,
      updated_by_user_id = current_user_id
  from public.families as family
  where vehicle.id = target_vehicle_id
    and vehicle.family_id = family.id
    and family.owner_user_id = current_user_id
    and vehicle.status = case when archive then 'active' else 'archived' end
    and vehicle.version = expected_version
  returning vehicle.* into updated_vehicle;

  if updated_vehicle.id is null then
    raise exception using errcode = 'P0002', message = 'El vehículo no existe, su estado no permite la acción o cambió en otra sesión.';
  end if;

  if archive then
    update public.reminders as reminder
    set status = 'cancelled', cancelled_at = statement_timestamp(),
        attended_at = null, updated_by_user_id = current_user_id
    from public.documents as document
    where document.vehicle_id = target_vehicle_id
      and document.family_id = updated_vehicle.family_id
      and reminder.family_id = document.family_id
      and reminder.document_id = document.id
      and reminder.status in ('scheduled', 'notified');
  end if;

  return updated_vehicle;
end;
$$;

-- ===== Permisos del proceso seguro =====

revoke all on function public.finalize_vehicle_document_upload(
  uuid, uuid, uuid, uuid, uuid, text, text, date, date, text, text, text,
  text, text, text, bigint, text
) from public, anon, authenticated;

grant execute on function public.finalize_vehicle_document_upload(
  uuid, uuid, uuid, uuid, uuid, text, text, date, date, text, text, text,
  text, text, text, bigint, text
) to service_role;
