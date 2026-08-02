-- ============================================================================
-- Corrección de tipos para recordatorios de kilometraje
-- ============================================================================

-- ===== Registro manual con reinicio del aviso =====

create or replace function public.record_vehicle_mileage(
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
        0::smallint,
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

create or replace function public.configure_vehicle_mileage_reminder(
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
      0::smallint,
      family_timezone
    ),
    current_user_id, current_user_id
  ) returning * into created_reminder;

  return created_reminder;
end;
$$;
