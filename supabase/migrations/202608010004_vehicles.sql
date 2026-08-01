-- ============================================================================
-- Módulo inicial de vehículos
-- ============================================================================

-- ===== Modelo principal =====

create table public.vehicles (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  name varchar(100) not null,
  type varchar(30) not null,
  make varchar(80),
  model varchar(80),
  model_year smallint,
  trim varchar(100),
  color varchar(50),
  vin varchar(17),
  license_plate varchar(20),
  mileage integer,
  fuel_type varchar(30),
  notes varchar(2000),
  status varchar(20) not null default 'active',
  archived_at timestamptz,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1,
  constraint vehicles_family_id_unique unique (family_id, id),
  constraint vehicles_name_length check (char_length(trim(name)) between 2 and 100),
  constraint vehicles_type_allowed check (type in ('car', 'truck', 'motorcycle', 'trailer', 'recreational', 'other')),
  constraint vehicles_make_length check (make is null or char_length(make) <= 80),
  constraint vehicles_model_length check (model is null or char_length(model) <= 80),
  constraint vehicles_year_allowed check (model_year is null or model_year between 1886 and 2200),
  constraint vehicles_trim_length check (trim is null or char_length(trim) <= 100),
  constraint vehicles_color_length check (color is null or char_length(color) <= 50),
  constraint vehicles_vin_length check (vin is null or char_length(vin) between 11 and 17),
  constraint vehicles_plate_length check (license_plate is null or char_length(license_plate) <= 20),
  constraint vehicles_mileage_allowed check (mileage is null or mileage >= 0),
  constraint vehicles_fuel_allowed check (fuel_type is null or fuel_type in ('gasoline', 'diesel', 'hybrid', 'electric', 'other')),
  constraint vehicles_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint vehicles_status_allowed check (status in ('active', 'archived')),
  constraint vehicles_archive_consistent check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  ),
  constraint vehicles_version_positive check (version >= 1),
  constraint vehicles_created_by_owner_fk foreign key (family_id, created_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint vehicles_updated_by_owner_fk foreign key (family_id, updated_by_user_id)
    references public.families (id, owner_user_id) on delete restrict
);

create index vehicles_family_status_updated_idx
  on public.vehicles (family_id, status, updated_at desc);

create trigger vehicles_set_updated_fields before update on public.vehicles
for each row execute function public.set_updated_fields();

-- ===== Lectura segura =====

alter table public.vehicles enable row level security;

revoke all on public.vehicles from anon, authenticated;
grant select on public.vehicles to authenticated;

create policy vehicles_select_owned on public.vehicles
for select to authenticated
using (exists (
  select 1
  from public.families
  where families.id = vehicles.family_id
    and families.owner_user_id = (select auth.uid())
));

-- ===== Creación de vehículos =====

create function public.create_vehicle(
  vehicle_id uuid,
  target_family_id uuid,
  vehicle_name text,
  vehicle_type text,
  vehicle_make text,
  vehicle_model text,
  vehicle_model_year smallint,
  vehicle_trim text,
  vehicle_color text,
  vehicle_vin text,
  vehicle_license_plate text,
  vehicle_mileage integer,
  vehicle_fuel_type text,
  vehicle_notes text
)
returns public.vehicles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_family_owner(target_family_id);
  created_vehicle public.vehicles;
  existing_vehicle public.vehicles;
begin
  -- ===== Validación de reglas temporales =====

  if vehicle_model_year is not null
    and vehicle_model_year > extract(year from current_date)::integer + 1 then
    raise exception using errcode = '22023', message = 'El año del vehículo no puede ser posterior al siguiente año.';
  end if;

  -- ===== Validación de idempotencia =====

  select * into existing_vehicle from public.vehicles where id = vehicle_id;

  if existing_vehicle.id is not null then
    if existing_vehicle.family_id = target_family_id
      and existing_vehicle.created_by_user_id = current_user_id then
      return existing_vehicle;
    end if;

    raise exception using errcode = '23505', message = 'El identificador del vehículo ya está en uso.';
  end if;

  -- ===== Persistencia del vehículo =====

  insert into public.vehicles (
    id, family_id, name, type, make, model, model_year, trim, color, vin,
    license_plate, mileage, fuel_type, notes, created_by_user_id,
    updated_by_user_id
  ) values (
    vehicle_id, target_family_id, trim(vehicle_name), vehicle_type,
    nullif(trim(vehicle_make), ''), nullif(trim(vehicle_model), ''),
    vehicle_model_year, nullif(trim(vehicle_trim), ''),
    nullif(trim(vehicle_color), ''), nullif(upper(trim(vehicle_vin)), ''),
    nullif(upper(trim(vehicle_license_plate)), ''), vehicle_mileage,
    nullif(vehicle_fuel_type, ''), nullif(trim(vehicle_notes), ''),
    current_user_id, current_user_id
  ) returning * into created_vehicle;

  return created_vehicle;
end;
$$;

-- ===== Actualización de vehículos =====

create function public.update_vehicle(
  target_vehicle_id uuid,
  vehicle_name text,
  vehicle_type text,
  vehicle_make text,
  vehicle_model text,
  vehicle_model_year smallint,
  vehicle_trim text,
  vehicle_color text,
  vehicle_vin text,
  vehicle_license_plate text,
  vehicle_mileage integer,
  vehicle_fuel_type text,
  vehicle_notes text,
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
  -- ===== Validación de reglas temporales =====

  if vehicle_model_year is not null
    and vehicle_model_year > extract(year from current_date)::integer + 1 then
    raise exception using errcode = '22023', message = 'El año del vehículo no puede ser posterior al siguiente año.';
  end if;

  -- ===== Persistencia con control de versión =====

  update public.vehicles as vehicle
  set name = trim(vehicle_name),
      type = vehicle_type,
      make = nullif(trim(vehicle_make), ''),
      model = nullif(trim(vehicle_model), ''),
      model_year = vehicle_model_year,
      trim = nullif(trim(vehicle_trim), ''),
      color = nullif(trim(vehicle_color), ''),
      vin = nullif(upper(trim(vehicle_vin)), ''),
      license_plate = nullif(upper(trim(vehicle_license_plate)), ''),
      mileage = vehicle_mileage,
      fuel_type = nullif(vehicle_fuel_type, ''),
      notes = nullif(trim(vehicle_notes), ''),
      updated_by_user_id = current_user_id
  from public.families as family
  where vehicle.id = target_vehicle_id
    and vehicle.family_id = family.id
    and family.owner_user_id = current_user_id
    and vehicle.status = 'active'
    and vehicle.version = expected_version
  returning vehicle.* into updated_vehicle;

  if updated_vehicle.id is null then
    raise exception using errcode = 'P0002', message = 'El vehículo no existe, está archivado o cambió en otra sesión.';
  end if;

  return updated_vehicle;
end;
$$;

-- ===== Archivado y restauración =====

create function public.set_vehicle_archived(
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
  -- ===== Cambio de estado con control de versión =====

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

  return updated_vehicle;
end;
$$;

-- ===== Permisos de ejecución =====

revoke all on function public.create_vehicle(uuid, uuid, text, text, text, text, smallint, text, text, text, text, integer, text, text)
  from public, anon, authenticated;
revoke all on function public.update_vehicle(uuid, text, text, text, text, smallint, text, text, text, text, integer, text, text, bigint)
  from public, anon, authenticated;
revoke all on function public.set_vehicle_archived(uuid, boolean, bigint)
  from public, anon, authenticated;

grant execute on function public.create_vehicle(uuid, uuid, text, text, text, text, smallint, text, text, text, text, integer, text, text)
  to authenticated;
grant execute on function public.update_vehicle(uuid, text, text, text, text, smallint, text, text, text, text, integer, text, text, bigint)
  to authenticated;
grant execute on function public.set_vehicle_archived(uuid, boolean, bigint)
  to authenticated;
