-- ============================================================================
-- Bitácora de mantenimiento vehicular
-- ============================================================================

-- ===== Servicios vehiculares =====

create table public.vehicle_services (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  vehicle_id uuid not null,
  title varchar(150) not null,
  type varchar(30) not null,
  status varchar(20) not null,
  service_date date,
  mileage integer,
  provider varchar(150),
  cost numeric(12, 2),
  notes varchar(3000),
  next_due_date date,
  next_due_mileage integer,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1,
  constraint vehicle_services_family_id_unique unique (family_id, id),
  constraint vehicle_services_vehicle_fk foreign key (family_id, vehicle_id)
    references public.vehicles (family_id, id) on delete restrict,
  constraint vehicle_services_created_by_owner_fk foreign key (family_id, created_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint vehicle_services_updated_by_owner_fk foreign key (family_id, updated_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint vehicle_services_title_length check (char_length(trim(title)) between 2 and 150),
  constraint vehicle_services_type_allowed check (type in (
    'preventive', 'corrective', 'repair', 'diagnostic', 'inspection', 'general', 'other'
  )),
  constraint vehicle_services_status_allowed check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  constraint vehicle_services_mileage_allowed check (mileage is null or mileage >= 0),
  constraint vehicle_services_provider_length check (provider is null or char_length(provider) <= 150),
  constraint vehicle_services_cost_allowed check (cost is null or cost >= 0),
  constraint vehicle_services_notes_length check (notes is null or char_length(notes) <= 3000),
  constraint vehicle_services_next_mileage_allowed check (
    next_due_mileage is null or next_due_mileage >= 0
  ),
  constraint vehicle_services_version_positive check (version >= 1)
);

create index vehicle_services_vehicle_date_idx
  on public.vehicle_services (family_id, vehicle_id, service_date desc, created_at desc);
create index vehicle_services_next_due_idx
  on public.vehicle_services (family_id, next_due_date)
  where status <> 'cancelled' and next_due_date is not null;

create trigger vehicle_services_set_updated_fields before update on public.vehicle_services
for each row execute function public.set_updated_fields();

-- ===== Recordatorios asociados con servicios =====

alter table public.reminders
  alter column document_id drop not null,
  add column vehicle_service_id uuid,
  add constraint reminders_vehicle_service_fk foreign key (family_id, vehicle_service_id)
    references public.vehicle_services (family_id, id) on delete restrict,
  add constraint reminders_single_target check (
    (document_id is not null and vehicle_service_id is null)
    or (document_id is null and vehicle_service_id is not null)
  );

create unique index reminders_one_open_service_idx
  on public.reminders (family_id, vehicle_service_id)
  where vehicle_service_id is not null and status in ('scheduled', 'notified');

-- ===== Lectura segura =====

alter table public.vehicle_services enable row level security;
revoke all on public.vehicle_services from anon, authenticated;
grant select on public.vehicle_services to authenticated;

create policy vehicle_services_select_owned on public.vehicle_services
for select to authenticated
using (exists (
  select 1 from public.families
  where families.id = vehicle_services.family_id
    and families.owner_user_id = (select auth.uid())
));

-- ===== Cancelación de avisos al archivar el vehículo =====

create function public.cancel_vehicle_service_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'active' and new.status = 'archived' then
    update public.reminders as reminder
    set status = 'cancelled', cancelled_at = statement_timestamp(),
        attended_at = null, updated_by_user_id = new.updated_by_user_id
    from public.vehicle_services as service
    where service.vehicle_id = new.id
      and service.family_id = new.family_id
      and reminder.family_id = service.family_id
      and reminder.vehicle_service_id = service.id
      and reminder.status in ('scheduled', 'notified');
  end if;

  return new;
end;
$$;

create trigger vehicles_cancel_service_reminders after update of status on public.vehicles
for each row execute function public.cancel_vehicle_service_reminders();

revoke all on function public.cancel_vehicle_service_reminders() from public;

-- ===== Creación de servicios =====

create function public.create_vehicle_service(
  service_id uuid,
  target_vehicle_id uuid,
  service_title text,
  service_type text,
  service_status text,
  service_date_value date,
  service_mileage integer,
  service_provider text,
  service_cost numeric,
  service_notes text,
  service_next_due_date date,
  service_next_due_mileage integer,
  reminder_lead_days smallint,
  reminder_repeat_interval_days smallint
)
returns public.vehicle_services
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  vehicle_record public.vehicles;
  family_timezone text;
  created_service public.vehicle_services;
begin
  -- ===== Validación del vehículo y frecuencia =====

  select vehicle.* into vehicle_record
  from public.vehicles as vehicle
  join public.families as family on family.id = vehicle.family_id
  where vehicle.id = target_vehicle_id
    and vehicle.status = 'active'
    and family.owner_user_id = current_user_id;

  if vehicle_record.id is null then
    raise exception using errcode = 'P0002', message = 'El vehículo no existe o está archivado.';
  end if;

  if reminder_repeat_interval_days is not null and reminder_repeat_interval_days not in (1, 7) then
    raise exception using errcode = '22023', message = 'La frecuencia de repetición no es válida.';
  end if;

  -- ===== Persistencia del servicio =====

  insert into public.vehicle_services (
    id, family_id, vehicle_id, title, type, status, service_date, mileage,
    provider, cost, notes, next_due_date, next_due_mileage,
    created_by_user_id, updated_by_user_id
  ) values (
    service_id, vehicle_record.family_id, vehicle_record.id,
    trim(service_title), service_type, service_status, service_date_value,
    service_mileage, nullif(trim(service_provider), ''), service_cost,
    nullif(trim(service_notes), ''), service_next_due_date,
    service_next_due_mileage, current_user_id, current_user_id
  ) returning * into created_service;

  -- ===== Actualización conservadora del kilometraje =====

  if service_mileage is not null
    and (vehicle_record.mileage is null or service_mileage > vehicle_record.mileage) then
    update public.vehicles
    set mileage = service_mileage, updated_by_user_id = current_user_id
    where id = vehicle_record.id;
  end if;

  -- ===== Programación del próximo aviso =====

  if service_next_due_date is not null and service_status <> 'cancelled'
    and reminder_lead_days is not null then
    select timezone into family_timezone
    from public.families where id = vehicle_record.family_id;

    insert into public.reminders (
      family_id, vehicle_service_id, lead_days, repeat_interval_days,
      scheduled_for, created_by_user_id, updated_by_user_id
    ) values (
      vehicle_record.family_id, created_service.id, reminder_lead_days,
      reminder_repeat_interval_days,
      public.calculate_reminder_time(service_next_due_date, reminder_lead_days, family_timezone),
      current_user_id, current_user_id
    );

    perform public.notify_due_reminders_for_family(vehicle_record.family_id, 1);
  end if;

  return created_service;
end;
$$;

-- ===== Actualización de servicios =====

create function public.update_vehicle_service(
  target_service_id uuid,
  service_title text,
  service_type text,
  service_status text,
  service_date_value date,
  service_mileage integer,
  service_provider text,
  service_cost numeric,
  service_notes text,
  service_next_due_date date,
  service_next_due_mileage integer,
  reminder_lead_days smallint,
  reminder_repeat_interval_days smallint,
  expected_version bigint
)
returns public.vehicle_services
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  updated_service public.vehicle_services;
  family_timezone text;
begin
  -- ===== Persistencia con permisos y control de versión =====

  update public.vehicle_services as service
  set title = trim(service_title), type = service_type, status = service_status,
      service_date = service_date_value, mileage = service_mileage,
      provider = nullif(trim(service_provider), ''), cost = service_cost,
      notes = nullif(trim(service_notes), ''), next_due_date = service_next_due_date,
      next_due_mileage = service_next_due_mileage,
      updated_by_user_id = current_user_id
  from public.vehicles as vehicle, public.families as family
  where service.id = target_service_id
    and service.vehicle_id = vehicle.id and service.family_id = vehicle.family_id
    and vehicle.status = 'active' and vehicle.family_id = family.id
    and family.owner_user_id = current_user_id
    and service.version = expected_version
  returning service.* into updated_service;

  if updated_service.id is null then
    raise exception using errcode = 'P0002', message = 'El servicio no existe o cambió en otra sesión.';
  end if;

  -- ===== Sustitución del recordatorio abierto =====

  update public.reminders
  set status = 'cancelled', cancelled_at = statement_timestamp(),
      attended_at = null, updated_by_user_id = current_user_id
  where vehicle_service_id = updated_service.id
    and family_id = updated_service.family_id
    and status in ('scheduled', 'notified');

  if service_next_due_date is not null and service_status <> 'cancelled'
    and reminder_lead_days is not null then
    select timezone into family_timezone
    from public.families where id = updated_service.family_id;

    insert into public.reminders (
      family_id, vehicle_service_id, lead_days, repeat_interval_days,
      scheduled_for, created_by_user_id, updated_by_user_id
    ) values (
      updated_service.family_id, updated_service.id, reminder_lead_days,
      reminder_repeat_interval_days,
      public.calculate_reminder_time(service_next_due_date, reminder_lead_days, family_timezone),
      current_user_id, current_user_id
    );

    perform public.notify_due_reminders_for_family(updated_service.family_id, 1);
  end if;

  update public.vehicles
  set mileage = service_mileage, updated_by_user_id = current_user_id
  where id = updated_service.vehicle_id
    and service_mileage is not null
    and (mileage is null or service_mileage > mileage);

  return updated_service;
end;
$$;

-- ===== Procesamiento compartido de avisos =====

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
      family.owner_user_id,
      coalesce(document.name, service.title) as target_name,
      coalesce(document.expiration_date, service.next_due_date) as due_date
    from public.reminders as reminder
    join public.families as family on family.id = reminder.family_id
    left join public.documents as document
      on document.family_id = reminder.family_id and document.id = reminder.document_id
    left join public.vehicle_services as service
      on service.family_id = reminder.family_id and service.id = reminder.vehicle_service_id
    left join public.vehicles as vehicle
      on vehicle.family_id = service.family_id and vehicle.id = service.vehicle_id
    where reminder.family_id = target_family_id
      and (reminder.status = 'scheduled'
        or (reminder.status = 'notified' and reminder.repeat_interval_days is not null))
      and reminder.scheduled_for <= statement_timestamp()
      and (
        (document.id is not null and document.status = 'active'
          and public.is_active_document_parent(document.family_id, document.property_id, document.vehicle_id))
        or (service.id is not null and service.status <> 'cancelled' and vehicle.status = 'active')
      )
    order by reminder.scheduled_for
    for update of reminder skip locked
    limit batch_size
  loop
    insert into public.notifications (
      family_id, reminder_id, recipient_user_id, title, message, occurrence_at
    ) values (
      target_family_id, due_reminder.id, due_reminder.owner_user_id,
      left('Revisa: ' || due_reminder.target_name, 200),
      left(format('“%s” requiere atención el %s.', due_reminder.target_name,
        to_char(due_reminder.due_date, 'DD/MM/YYYY')), 500),
      due_reminder.scheduled_for
    ) on conflict (reminder_id, recipient_user_id, occurrence_at) do nothing;

    update public.reminders
    set status = 'notified', notified_at = coalesce(notified_at, statement_timestamp()),
        scheduled_for = case when repeat_interval_days is null then scheduled_for
          else statement_timestamp() + make_interval(days => repeat_interval_days::integer) end,
        updated_by_user_id = due_reminder.owner_user_id
    where id = due_reminder.id;

    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$$;

create or replace function public.process_due_reminders(batch_size integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  family_record record;
  processed_count integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'La operación requiere el proceso de recordatorios.';
  end if;

  for family_record in
    select distinct reminder.family_id
    from public.reminders as reminder
    where reminder.scheduled_for <= statement_timestamp()
      and (reminder.status = 'scheduled'
        or (reminder.status = 'notified' and reminder.repeat_interval_days is not null))
    limit batch_size
  loop
    processed_count := processed_count
      + public.notify_due_reminders_for_family(family_record.family_id, batch_size - processed_count);
    exit when processed_count >= batch_size;
  end loop;

  return processed_count;
end;
$$;

-- ===== Permisos de ejecución =====

revoke all on function public.create_vehicle_service(
  uuid, uuid, text, text, text, date, integer, text, numeric, text, date,
  integer, smallint, smallint
) from public, anon, authenticated;
revoke all on function public.update_vehicle_service(
  uuid, text, text, text, date, integer, text, numeric, text, date, integer,
  smallint, smallint, bigint
) from public, anon, authenticated;

grant execute on function public.create_vehicle_service(
  uuid, uuid, text, text, text, date, integer, text, numeric, text, date,
  integer, smallint, smallint
) to authenticated;
grant execute on function public.update_vehicle_service(
  uuid, text, text, text, date, integer, text, numeric, text, date, integer,
  smallint, smallint, bigint
) to authenticated;
