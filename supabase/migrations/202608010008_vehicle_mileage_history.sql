-- ============================================================================
-- Historial y seguimiento periódico del kilometraje vehicular
-- ============================================================================

-- ===== Bitácora inmutable de lecturas =====

create table public.vehicle_mileage_readings (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  vehicle_id uuid not null,
  mileage integer not null,
  recorded_on date not null,
  source varchar(20) not null,
  notes varchar(1000),
  recorded_by_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint vehicle_mileage_readings_family_id_unique unique (family_id, id),
  constraint vehicle_mileage_readings_vehicle_fk
    foreign key (family_id, vehicle_id)
    references public.vehicles (family_id, id) on delete restrict,
  constraint vehicle_mileage_readings_recorded_by_owner_fk
    foreign key (family_id, recorded_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint vehicle_mileage_readings_mileage_allowed check (mileage >= 0),
  constraint vehicle_mileage_readings_source_allowed check (
    source in ('initial', 'manual', 'automatic')
  ),
  constraint vehicle_mileage_readings_notes_length check (
    notes is null or char_length(notes) <= 1000
  )
);

create unique index vehicle_mileage_readings_natural_unique
  on public.vehicle_mileage_readings (
    family_id, vehicle_id, recorded_on, mileage
  );

create index vehicle_mileage_readings_history_idx
  on public.vehicle_mileage_readings (
    family_id, vehicle_id, recorded_on desc, created_at desc
  );

-- ===== Lectura segura y escritura exclusiva mediante funciones =====

alter table public.vehicle_mileage_readings enable row level security;

revoke all on public.vehicle_mileage_readings from anon, authenticated;
grant select on public.vehicle_mileage_readings to authenticated;

create policy vehicle_mileage_readings_select_owned
on public.vehicle_mileage_readings
for select to authenticated
using (exists (
  select 1 from public.families
  where families.id = vehicle_mileage_readings.family_id
    and families.owner_user_id = (select auth.uid())
));

-- ===== Conservación de kilometrajes ya registrados =====

insert into public.vehicle_mileage_readings (
  family_id, vehicle_id, mileage, recorded_on, source, recorded_by_user_id
)
select vehicle.family_id, vehicle.id, vehicle.mileage,
  (vehicle.updated_at at time zone family.timezone)::date,
  'initial', vehicle.updated_by_user_id
from public.vehicles as vehicle
join public.families as family on family.id = vehicle.family_id
where vehicle.mileage is not null
on conflict do nothing;

-- ===== Captura automática de cambios realizados por otros flujos =====

create function public.capture_vehicle_mileage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  family_timezone text;
begin
  -- ===== Descarte de cambios que no generan una lectura nueva =====

  if new.mileage is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.mileage is not null
    and new.mileage <= old.mileage then
    return new;
  end if;

  -- ------- La función de registro manual crea una lectura más completa -------

  if current_setting('gid.skip_mileage_history', true) = 'on' then
    return new;
  end if;

  -- ===== Preparación de la fecha familiar =====

  select family.timezone into family_timezone
  from public.families as family
  where family.id = new.family_id;

  -- ===== Persistencia automática =====

  insert into public.vehicle_mileage_readings (
    family_id, vehicle_id, mileage, recorded_on, source, recorded_by_user_id
  ) values (
    new.family_id, new.id, new.mileage,
    (statement_timestamp() at time zone family_timezone)::date,
    case when tg_op = 'INSERT' then 'initial' else 'automatic' end,
    new.updated_by_user_id
  ) on conflict do nothing;

  return new;
end;
$$;

create trigger vehicles_capture_mileage_change
after insert or update of mileage on public.vehicles
for each row execute function public.capture_vehicle_mileage_change();

revoke all on function public.capture_vehicle_mileage_change()
  from public, anon, authenticated;

-- ===== Recordatorio periódico asociado con el vehículo =====

alter table public.reminders
  drop constraint reminders_single_target,
  add column vehicle_id uuid,
  add constraint reminders_vehicle_fk foreign key (family_id, vehicle_id)
    references public.vehicles (family_id, id) on delete restrict,
  add constraint reminders_single_target check (
    num_nonnulls(document_id, vehicle_service_id, vehicle_id) = 1
  );

alter table public.reminders
  drop constraint reminders_repeat_interval_allowed,
  add constraint reminders_repeat_interval_allowed check (
    repeat_interval_days is null
    or repeat_interval_days in (1, 7, 30, 60, 90)
  );

create unique index reminders_one_open_vehicle_mileage_idx
  on public.reminders (family_id, vehicle_id)
  where vehicle_id is not null and status in ('scheduled', 'notified');

-- ===== Registro manual de una lectura =====

create function public.record_vehicle_mileage(
  reading_id uuid,
  target_vehicle_id uuid,
  reading_mileage integer,
  reading_recorded_on date,
  reading_notes text
)
returns public.vehicle_mileage_readings
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  vehicle_record public.vehicles;
  family_timezone text;
  local_date date;
  existing_reading public.vehicle_mileage_readings;
  created_reading public.vehicle_mileage_readings;
begin
  -- ===== Validación del vehículo propietario =====

  select vehicle.* into vehicle_record
  from public.vehicles as vehicle
  join public.families as family on family.id = vehicle.family_id
  where vehicle.id = target_vehicle_id
    and vehicle.status = 'active'
    and family.owner_user_id = current_user_id;

  if vehicle_record.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'El vehículo no existe o está archivado.';
  end if;

  select family.timezone into family_timezone
  from public.families as family
  where family.id = vehicle_record.family_id;

  local_date := (statement_timestamp() at time zone family_timezone)::date;

  if reading_recorded_on > local_date then
    raise exception using
      errcode = '22023',
      message = 'La fecha de la lectura no puede estar en el futuro.';
  end if;

  if vehicle_record.mileage is not null
    and reading_mileage < vehicle_record.mileage then
    raise exception using
      errcode = '22023',
      message = 'El kilometraje no puede ser menor al actual.';
  end if;

  -- ===== Validación de idempotencia =====

  select reading.* into existing_reading
  from public.vehicle_mileage_readings as reading
  where reading.id = reading_id
    and reading.family_id = vehicle_record.family_id
    and reading.vehicle_id = vehicle_record.id;

  if existing_reading.id is not null then
    return existing_reading;
  end if;

  select reading.* into existing_reading
  from public.vehicle_mileage_readings as reading
  where reading.family_id = vehicle_record.family_id
    and reading.vehicle_id = vehicle_record.id
    and reading.recorded_on = reading_recorded_on
    and reading.mileage = reading_mileage;

  if existing_reading.id is not null then
    return existing_reading;
  end if;

  -- ===== Actualización conservadora del vehículo =====

  if vehicle_record.mileage is null
    or reading_mileage > vehicle_record.mileage then
    perform set_config('gid.skip_mileage_history', 'on', true);

    update public.vehicles
    set mileage = reading_mileage, updated_by_user_id = current_user_id
    where id = vehicle_record.id;
  end if;

  -- ===== Persistencia de la lectura manual =====

  insert into public.vehicle_mileage_readings (
    id, family_id, vehicle_id, mileage, recorded_on, source, notes,
    recorded_by_user_id
  ) values (
    reading_id, vehicle_record.family_id, vehicle_record.id, reading_mileage,
    reading_recorded_on, 'manual', nullif(trim(reading_notes), ''),
    current_user_id
  ) returning * into created_reading;

  -- ===== Reinicio del recordatorio periódico =====

  update public.notifications as notification
  set status = 'read', read_at = coalesce(read_at, statement_timestamp())
  from public.reminders as reminder
  where reminder.family_id = vehicle_record.family_id
    and reminder.vehicle_id = vehicle_record.id
    and notification.family_id = reminder.family_id
    and notification.reminder_id = reminder.id
    and notification.status = 'unread';

  update public.reminders
  set status = 'scheduled', notified_at = null, attended_at = null,
      cancelled_at = null,
      scheduled_for = public.calculate_reminder_time(
        local_date + repeat_interval_days::integer,
        0,
        family_timezone
      ),
      updated_by_user_id = current_user_id
  where family_id = vehicle_record.family_id
    and vehicle_id = vehicle_record.id
    and status in ('scheduled', 'notified');

  return created_reading;
end;
$$;

-- ===== Configuración del aviso periódico =====

create function public.configure_vehicle_mileage_reminder(
  target_vehicle_id uuid,
  interval_days smallint
)
returns public.reminders
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  vehicle_record public.vehicles;
  family_timezone text;
  local_date date;
  created_reminder public.reminders;
begin
  -- ===== Validación del vehículo y frecuencia =====

  select vehicle.* into vehicle_record
  from public.vehicles as vehicle
  join public.families as family on family.id = vehicle.family_id
  where vehicle.id = target_vehicle_id
    and vehicle.status = 'active'
    and family.owner_user_id = current_user_id;

  if vehicle_record.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'El vehículo no existe o está archivado.';
  end if;

  select family.timezone into family_timezone
  from public.families as family
  where family.id = vehicle_record.family_id;

  if interval_days is not null and interval_days not in (30, 60, 90) then
    raise exception using
      errcode = '22023',
      message = 'La frecuencia del recordatorio no es válida.';
  end if;

  local_date := (statement_timestamp() at time zone family_timezone)::date;

  -- ===== Sustitución de la configuración anterior =====

  update public.reminders
  set status = 'cancelled', attended_at = null,
      cancelled_at = statement_timestamp(), updated_by_user_id = current_user_id
  where family_id = vehicle_record.family_id
    and vehicle_id = vehicle_record.id
    and status in ('scheduled', 'notified');

  if interval_days is null then
    return null;
  end if;

  insert into public.reminders (
    family_id, vehicle_id, lead_days, repeat_interval_days, scheduled_for,
    created_by_user_id, updated_by_user_id
  ) values (
    vehicle_record.family_id, vehicle_record.id, 0, interval_days,
    public.calculate_reminder_time(
      local_date + interval_days::integer,
      0,
      family_timezone
    ),
    current_user_id, current_user_id
  ) returning * into created_reminder;

  return created_reminder;
end;
$$;

-- ===== Cancelación del aviso al archivar el vehículo =====

create function public.cancel_vehicle_mileage_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'active' and new.status = 'archived' then
    update public.reminders
    set status = 'cancelled', attended_at = null,
        cancelled_at = statement_timestamp(),
        updated_by_user_id = new.updated_by_user_id
    where family_id = new.family_id
      and vehicle_id = new.id
      and status in ('scheduled', 'notified');
  end if;

  return new;
end;
$$;

create trigger vehicles_cancel_mileage_reminder
after update of status on public.vehicles
for each row execute function public.cancel_vehicle_mileage_reminder();

revoke all on function public.cancel_vehicle_mileage_reminder()
  from public, anon, authenticated;

-- ===== Notificaciones para todos los tipos de recordatorio =====

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
  -- ===== Selección bloqueada de recordatorios vencidos =====

  for due_reminder in
    select reminder.id, reminder.scheduled_for, reminder.repeat_interval_days,
      family.owner_user_id,
      coalesce(document.name, service.title, mileage_vehicle.name) as target_name,
      coalesce(
        document.expiration_date,
        service.next_due_date,
        (reminder.scheduled_for at time zone family.timezone)::date
      ) as due_date,
      mileage_vehicle.id is not null as is_mileage_check
    from public.reminders as reminder
    join public.families as family on family.id = reminder.family_id
    left join public.documents as document
      on document.family_id = reminder.family_id
      and document.id = reminder.document_id
    left join public.vehicle_services as service
      on service.family_id = reminder.family_id
      and service.id = reminder.vehicle_service_id
    left join public.vehicles as service_vehicle
      on service_vehicle.family_id = service.family_id
      and service_vehicle.id = service.vehicle_id
    left join public.vehicles as mileage_vehicle
      on mileage_vehicle.family_id = reminder.family_id
      and mileage_vehicle.id = reminder.vehicle_id
    where reminder.family_id = target_family_id
      and (
        reminder.status = 'scheduled'
        or (
          reminder.status = 'notified'
          and reminder.repeat_interval_days is not null
        )
      )
      and reminder.scheduled_for <= statement_timestamp()
      and (
        (
          document.id is not null
          and document.status = 'active'
          and public.is_active_document_parent(
            document.family_id,
            document.property_id,
            document.vehicle_id
          )
        )
        or (
          service.id is not null
          and service.status <> 'cancelled'
          and service_vehicle.status = 'active'
        )
        or (
          mileage_vehicle.id is not null
          and mileage_vehicle.status = 'active'
        )
      )
    order by reminder.scheduled_for
    for update of reminder skip locked
    limit batch_size
  loop
    -- ===== Creación de la notificación apropiada =====

    insert into public.notifications (
      family_id, reminder_id, recipient_user_id, title, message, occurrence_at
    ) values (
      target_family_id,
      due_reminder.id,
      due_reminder.owner_user_id,
      left(
        case when due_reminder.is_mileage_check
          then 'Actualiza kilometraje: ' || due_reminder.target_name
          else 'Revisa: ' || due_reminder.target_name
        end,
        200
      ),
      left(
        case when due_reminder.is_mileage_check
          then format(
            'Registra el kilometraje actual de “%s” para mantener sus avisos al día.',
            due_reminder.target_name
          )
          else format(
            '“%s” requiere atención el %s.',
            due_reminder.target_name,
            to_char(due_reminder.due_date, 'DD/MM/YYYY')
          )
        end,
        500
      ),
      due_reminder.scheduled_for
    ) on conflict (
      reminder_id,
      recipient_user_id,
      occurrence_at
    ) do nothing;

    -- ===== Programación de la siguiente repetición =====

    update public.reminders
    set status = 'notified',
        notified_at = coalesce(notified_at, statement_timestamp()),
        scheduled_for = case
          when repeat_interval_days is null then scheduled_for
          else statement_timestamp()
            + make_interval(days => repeat_interval_days::integer)
        end,
        updated_by_user_id = due_reminder.owner_user_id
    where id = due_reminder.id;

    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$$;

-- ===== Permisos de ejecución =====

revoke all on function public.record_vehicle_mileage(
  uuid, uuid, integer, date, text
) from public, anon, authenticated;
revoke all on function public.configure_vehicle_mileage_reminder(
  uuid, smallint
) from public, anon, authenticated;

grant execute on function public.record_vehicle_mileage(
  uuid, uuid, integer, date, text
) to authenticated;
grant execute on function public.configure_vehicle_mileage_reminder(
  uuid, smallint
) to authenticated;
