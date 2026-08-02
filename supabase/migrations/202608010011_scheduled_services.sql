-- ============================================================================
-- Servicios y obligaciones programadas
-- ============================================================================

-- ===== Configuración permanente del servicio =====

create table public.scheduled_services (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  property_id uuid,
  name varchar(150) not null,
  category varchar(30) not null,
  provider varchar(150),
  recurrence varchar(20) not null,
  custom_interval_days smallint,
  lead_days smallint not null default 7,
  repeat_interval_days smallint,
  notes varchar(2000),
  status varchar(20) not null default 'active',
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1,
  constraint scheduled_services_family_id_unique unique (family_id, id),
  constraint scheduled_services_property_fk foreign key (family_id, property_id)
    references public.properties (family_id, id) on delete restrict,
  constraint scheduled_services_created_by_owner_fk
    foreign key (family_id, created_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint scheduled_services_updated_by_owner_fk
    foreign key (family_id, updated_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint scheduled_services_name_length check (
    char_length(trim(name)) between 2 and 150
  ),
  constraint scheduled_services_category_allowed check (category in (
    'electricity', 'water', 'gas', 'internet', 'phone', 'insurance',
    'rent', 'property_tax', 'subscription', 'maintenance', 'other'
  )),
  constraint scheduled_services_provider_length check (
    provider is null or char_length(provider) <= 150
  ),
  constraint scheduled_services_recurrence_allowed check (recurrence in (
    'once', 'weekly', 'monthly', 'bimonthly', 'quarterly',
    'semiannual', 'annual', 'custom_days'
  )),
  constraint scheduled_services_custom_interval_consistent check (
    (recurrence = 'custom_days' and custom_interval_days between 1 and 3650)
    or (recurrence <> 'custom_days' and custom_interval_days is null)
  ),
  constraint scheduled_services_lead_days_allowed check (
    lead_days in (0, 1, 3, 7, 15, 30)
  ),
  constraint scheduled_services_repeat_interval_allowed check (
    repeat_interval_days is null or repeat_interval_days in (1, 7)
  ),
  constraint scheduled_services_notes_length check (
    notes is null or char_length(notes) <= 2000
  ),
  constraint scheduled_services_status_allowed check (
    status in ('active', 'completed', 'cancelled')
  ),
  constraint scheduled_services_version_positive check (version >= 1)
);

create index scheduled_services_family_status_idx
  on public.scheduled_services (family_id, status, updated_at desc);
create index scheduled_services_property_idx
  on public.scheduled_services (family_id, property_id)
  where property_id is not null;

create trigger scheduled_services_set_updated_fields
before update on public.scheduled_services
for each row execute function public.set_updated_fields();

-- ===== Ocurrencias e historial de atención =====

create table public.scheduled_service_occurrences (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  scheduled_service_id uuid not null,
  sequence integer not null,
  due_date date not null,
  status varchar(20) not null default 'pending',
  resolved_at timestamptz,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1,
  constraint scheduled_service_occurrences_family_id_unique
    unique (family_id, id),
  constraint scheduled_service_occurrences_sequence_unique
    unique (family_id, scheduled_service_id, sequence),
  constraint scheduled_service_occurrences_service_fk
    foreign key (family_id, scheduled_service_id)
    references public.scheduled_services (family_id, id) on delete restrict,
  constraint scheduled_service_occurrences_created_by_owner_fk
    foreign key (family_id, created_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint scheduled_service_occurrences_updated_by_owner_fk
    foreign key (family_id, updated_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint scheduled_service_occurrences_sequence_positive check (sequence >= 1),
  constraint scheduled_service_occurrences_status_allowed check (
    status in ('pending', 'attended', 'skipped', 'cancelled')
  ),
  constraint scheduled_service_occurrences_resolution_consistent check (
    (status = 'pending' and resolved_at is null)
    or (status <> 'pending' and resolved_at is not null)
  ),
  constraint scheduled_service_occurrences_version_positive check (version >= 1)
);

create unique index scheduled_service_occurrences_one_pending_idx
  on public.scheduled_service_occurrences (family_id, scheduled_service_id)
  where status = 'pending';
create index scheduled_service_occurrences_due_idx
  on public.scheduled_service_occurrences (family_id, due_date)
  where status = 'pending';
create index scheduled_service_occurrences_history_idx
  on public.scheduled_service_occurrences (
    family_id, scheduled_service_id, sequence desc
  );

create trigger scheduled_service_occurrences_set_updated_fields
before update on public.scheduled_service_occurrences
for each row execute function public.set_updated_fields();

-- ===== Recordatorios asociados con cada ocurrencia =====

alter table public.reminders
  add column scheduled_service_occurrence_id uuid,
  add constraint reminders_scheduled_service_occurrence_fk
    foreign key (family_id, scheduled_service_occurrence_id)
    references public.scheduled_service_occurrences (family_id, id)
    on delete restrict;

alter table public.reminders
  drop constraint reminders_single_target,
  add constraint reminders_single_target check (
    num_nonnulls(
      document_id,
      vehicle_service_id,
      vehicle_id,
      scheduled_service_occurrence_id
    ) = 1
  );

create unique index reminders_one_open_scheduled_service_occurrence_idx
  on public.reminders (family_id, scheduled_service_occurrence_id)
  where scheduled_service_occurrence_id is not null
    and status in ('scheduled', 'notified');

-- ===== Lectura aislada por familia =====

alter table public.scheduled_services enable row level security;
alter table public.scheduled_service_occurrences enable row level security;

revoke all on public.scheduled_services from anon, authenticated;
revoke all on public.scheduled_service_occurrences from anon, authenticated;
grant select on public.scheduled_services to authenticated;
grant select on public.scheduled_service_occurrences to authenticated;

create policy scheduled_services_select_owned on public.scheduled_services
for select to authenticated
using (exists (
  select 1 from public.families
  where families.id = scheduled_services.family_id
    and families.owner_user_id = (select auth.uid())
));

create policy scheduled_service_occurrences_select_owned
on public.scheduled_service_occurrences
for select to authenticated
using (exists (
  select 1 from public.families
  where families.id = scheduled_service_occurrences.family_id
    and families.owner_user_id = (select auth.uid())
));

-- ===== Cálculo de la siguiente fecha =====

create function public.calculate_scheduled_service_next_due_date(
  current_due_date date,
  recurrence_value text,
  custom_days smallint
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  return case recurrence_value
    when 'weekly' then current_due_date + 7
    when 'monthly' then (current_due_date + interval '1 month')::date
    when 'bimonthly' then (current_due_date + interval '2 months')::date
    when 'quarterly' then (current_due_date + interval '3 months')::date
    when 'semiannual' then (current_due_date + interval '6 months')::date
    when 'annual' then (current_due_date + interval '1 year')::date
    when 'custom_days' then current_due_date + custom_days::integer
    else null
  end;
end;
$$;

-- ===== Creación del servicio y su primer vencimiento =====

create function public.create_scheduled_service(
  service_id uuid,
  occurrence_id uuid,
  target_family_id uuid,
  target_property_id uuid,
  service_name text,
  service_category text,
  service_provider text,
  recurrence_value text,
  custom_days smallint,
  first_due_date date,
  reminder_lead_days smallint,
  reminder_repeat_interval_days smallint,
  service_notes text
)
returns public.scheduled_services
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  family_timezone text;
  created_service public.scheduled_services;
begin
  -- ===== Validación del contexto familiar =====

  select family.timezone into family_timezone
  from public.families as family
  where family.id = target_family_id
    and family.owner_user_id = current_user_id;

  if family_timezone is null then
    raise exception using errcode = 'P0002', message = 'La familia no existe.';
  end if;

  if target_property_id is not null and not exists (
    select 1 from public.properties as property
    where property.id = target_property_id
      and property.family_id = target_family_id
      and property.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'La vivienda no existe o está archivada.';
  end if;

  if recurrence_value = 'custom_days'
    and (custom_days is null or custom_days not between 1 and 3650) then
    raise exception using errcode = '22023', message = 'El intervalo personalizado no es válido.';
  end if;

  -- ===== Persistencia de la configuración =====

  insert into public.scheduled_services (
    id, family_id, property_id, name, category, provider, recurrence,
    custom_interval_days, lead_days, repeat_interval_days, notes,
    created_by_user_id, updated_by_user_id
  ) values (
    service_id, target_family_id, target_property_id, trim(service_name),
    service_category, nullif(trim(service_provider), ''), recurrence_value,
    custom_days, reminder_lead_days, reminder_repeat_interval_days,
    nullif(trim(service_notes), ''), current_user_id, current_user_id
  ) returning * into created_service;

  insert into public.scheduled_service_occurrences (
    id, family_id, scheduled_service_id, sequence, due_date,
    created_by_user_id, updated_by_user_id
  ) values (
    occurrence_id, target_family_id, service_id, 1, first_due_date,
    current_user_id, current_user_id
  );

  insert into public.reminders (
    family_id, scheduled_service_occurrence_id, lead_days,
    repeat_interval_days, scheduled_for, created_by_user_id, updated_by_user_id
  ) values (
    target_family_id, occurrence_id, reminder_lead_days,
    reminder_repeat_interval_days,
    public.calculate_reminder_time(
      first_due_date, reminder_lead_days, family_timezone
    ),
    current_user_id, current_user_id
  );

  perform public.notify_due_reminders_for_family(target_family_id, 1);

  return created_service;
end;
$$;

-- ===== Edición de la configuración y el vencimiento pendiente =====

create function public.update_scheduled_service(
  target_service_id uuid,
  target_property_id uuid,
  service_name text,
  service_category text,
  service_provider text,
  recurrence_value text,
  custom_days smallint,
  next_due_date date,
  reminder_lead_days smallint,
  reminder_repeat_interval_days smallint,
  service_notes text,
  expected_version bigint
)
returns public.scheduled_services
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  updated_service public.scheduled_services;
  pending_occurrence public.scheduled_service_occurrences;
  family_timezone text;
begin
  -- ===== Persistencia con control de versión =====

  update public.scheduled_services as service
  set property_id = target_property_id,
      name = trim(service_name),
      category = service_category,
      provider = nullif(trim(service_provider), ''),
      recurrence = recurrence_value,
      custom_interval_days = custom_days,
      lead_days = reminder_lead_days,
      repeat_interval_days = reminder_repeat_interval_days,
      notes = nullif(trim(service_notes), ''),
      updated_by_user_id = current_user_id
  from public.families as family
  where service.id = target_service_id
    and service.family_id = family.id
    and family.owner_user_id = current_user_id
    and service.status = 'active'
    and service.version = expected_version
    and (
      target_property_id is null
      or exists (
        select 1 from public.properties as property
        where property.id = target_property_id
          and property.family_id = service.family_id
          and property.status = 'active'
      )
    )
  returning service.* into updated_service;

  if updated_service.id is null then
    raise exception using errcode = 'P0002', message = 'El servicio no existe o cambió en otra sesión.';
  end if;

  select occurrence.* into pending_occurrence
  from public.scheduled_service_occurrences as occurrence
  where occurrence.family_id = updated_service.family_id
    and occurrence.scheduled_service_id = updated_service.id
    and occurrence.status = 'pending'
  for update;

  if pending_occurrence.id is null then
    raise exception using errcode = 'P0002', message = 'El servicio no tiene un vencimiento pendiente.';
  end if;

  -- ===== Sustitución del recordatorio pendiente =====

  update public.scheduled_service_occurrences
  set due_date = next_due_date, updated_by_user_id = current_user_id
  where id = pending_occurrence.id;

  update public.reminders
  set status = 'cancelled', cancelled_at = statement_timestamp(),
      attended_at = null, updated_by_user_id = current_user_id
  where family_id = updated_service.family_id
    and scheduled_service_occurrence_id = pending_occurrence.id
    and status in ('scheduled', 'notified');

  select family.timezone into family_timezone
  from public.families as family
  where family.id = updated_service.family_id;

  insert into public.reminders (
    family_id, scheduled_service_occurrence_id, lead_days,
    repeat_interval_days, scheduled_for, created_by_user_id, updated_by_user_id
  ) values (
    updated_service.family_id, pending_occurrence.id, reminder_lead_days,
    reminder_repeat_interval_days,
    public.calculate_reminder_time(
      next_due_date, reminder_lead_days, family_timezone
    ),
    current_user_id, current_user_id
  );

  perform public.notify_due_reminders_for_family(updated_service.family_id, 1);

  return updated_service;
end;
$$;

-- ===== Resolución y programación automática de la siguiente ocurrencia =====

create function public.resolve_scheduled_service_occurrence(
  target_occurrence_id uuid,
  resolution_status text,
  expected_version bigint
)
returns public.scheduled_service_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  resolved_occurrence public.scheduled_service_occurrences;
  service_record public.scheduled_services;
  family_timezone text;
  next_date date;
  next_occurrence_id uuid := extensions.gen_random_uuid();
begin
  -- ===== Validación y resolución de la ocurrencia =====

  if resolution_status not in ('attended', 'skipped') then
    raise exception using errcode = '22023', message = 'El estado de resolución no es válido.';
  end if;

  update public.scheduled_service_occurrences as occurrence
  set status = resolution_status,
      resolved_at = statement_timestamp(),
      updated_by_user_id = current_user_id
  from public.scheduled_services as service, public.families as family
  where occurrence.id = target_occurrence_id
    and occurrence.scheduled_service_id = service.id
    and occurrence.family_id = service.family_id
    and service.family_id = family.id
    and family.owner_user_id = current_user_id
    and service.status = 'active'
    and occurrence.status = 'pending'
    and occurrence.version = expected_version
  returning occurrence.* into resolved_occurrence;

  if resolved_occurrence.id is null then
    raise exception using errcode = 'P0002', message = 'El vencimiento no existe o cambió en otra sesión.';
  end if;

  select service.* into service_record
  from public.scheduled_services as service
  where service.id = resolved_occurrence.scheduled_service_id
  for update;

  update public.reminders
  set status = 'attended', attended_at = statement_timestamp(),
      notified_at = coalesce(notified_at, statement_timestamp()),
      cancelled_at = null, updated_by_user_id = current_user_id
  where family_id = resolved_occurrence.family_id
    and scheduled_service_occurrence_id = resolved_occurrence.id
    and status in ('scheduled', 'notified');

  update public.notifications as notification
  set status = 'read', read_at = coalesce(read_at, statement_timestamp())
  from public.reminders as reminder
  where reminder.family_id = resolved_occurrence.family_id
    and reminder.scheduled_service_occurrence_id = resolved_occurrence.id
    and notification.family_id = reminder.family_id
    and notification.reminder_id = reminder.id
    and notification.status = 'unread';

  -- ===== Cierre único o creación de la siguiente fecha =====

  if service_record.recurrence = 'once' then
    update public.scheduled_services
    set status = 'completed', updated_by_user_id = current_user_id
    where id = service_record.id;

    return resolved_occurrence;
  end if;

  next_date := public.calculate_scheduled_service_next_due_date(
    resolved_occurrence.due_date,
    service_record.recurrence,
    service_record.custom_interval_days
  );

  insert into public.scheduled_service_occurrences (
    id, family_id, scheduled_service_id, sequence, due_date,
    created_by_user_id, updated_by_user_id
  ) values (
    next_occurrence_id, resolved_occurrence.family_id, service_record.id,
    resolved_occurrence.sequence + 1, next_date,
    current_user_id, current_user_id
  );

  select family.timezone into family_timezone
  from public.families as family
  where family.id = resolved_occurrence.family_id;

  insert into public.reminders (
    family_id, scheduled_service_occurrence_id, lead_days,
    repeat_interval_days, scheduled_for, created_by_user_id, updated_by_user_id
  ) values (
    resolved_occurrence.family_id, next_occurrence_id,
    service_record.lead_days, service_record.repeat_interval_days,
    public.calculate_reminder_time(
      next_date, service_record.lead_days, family_timezone
    ),
    current_user_id, current_user_id
  );

  perform public.notify_due_reminders_for_family(
    resolved_occurrence.family_id, 1
  );

  return resolved_occurrence;
end;
$$;

-- ===== Cancelación de la programación =====

create function public.cancel_scheduled_service(
  target_service_id uuid,
  expected_version bigint
)
returns public.scheduled_services
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  cancelled_service public.scheduled_services;
begin
  update public.scheduled_services as service
  set status = 'cancelled', updated_by_user_id = current_user_id
  from public.families as family
  where service.id = target_service_id
    and service.family_id = family.id
    and family.owner_user_id = current_user_id
    and service.status = 'active'
    and service.version = expected_version
  returning service.* into cancelled_service;

  if cancelled_service.id is null then
    raise exception using errcode = 'P0002', message = 'El servicio no existe o cambió en otra sesión.';
  end if;

  update public.scheduled_service_occurrences
  set status = 'cancelled', resolved_at = statement_timestamp(),
      updated_by_user_id = current_user_id
  where family_id = cancelled_service.family_id
    and scheduled_service_id = cancelled_service.id
    and status = 'pending';

  update public.reminders as reminder
  set status = 'cancelled', cancelled_at = statement_timestamp(),
      attended_at = null, updated_by_user_id = current_user_id
  from public.scheduled_service_occurrences as occurrence
  where occurrence.family_id = cancelled_service.family_id
    and occurrence.scheduled_service_id = cancelled_service.id
    and reminder.family_id = occurrence.family_id
    and reminder.scheduled_service_occurrence_id = occurrence.id
    and reminder.status in ('scheduled', 'notified');

  return cancelled_service;
end;
$$;

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
  for due_reminder in
    select reminder.id, reminder.scheduled_for, reminder.repeat_interval_days,
      family.owner_user_id,
      coalesce(
        document.name,
        vehicle_service.title,
        mileage_vehicle.name,
        scheduled_service.name
      ) as target_name,
      coalesce(
        document.expiration_date,
        vehicle_service.next_due_date,
        occurrence.due_date,
        (reminder.scheduled_for at time zone family.timezone)::date
      ) as due_date,
      mileage_vehicle.id is not null as is_mileage_check
    from public.reminders as reminder
    join public.families as family on family.id = reminder.family_id
    left join public.documents as document
      on document.family_id = reminder.family_id
      and document.id = reminder.document_id
    left join public.vehicle_services as vehicle_service
      on vehicle_service.family_id = reminder.family_id
      and vehicle_service.id = reminder.vehicle_service_id
    left join public.vehicles as service_vehicle
      on service_vehicle.family_id = vehicle_service.family_id
      and service_vehicle.id = vehicle_service.vehicle_id
    left join public.vehicles as mileage_vehicle
      on mileage_vehicle.family_id = reminder.family_id
      and mileage_vehicle.id = reminder.vehicle_id
    left join public.scheduled_service_occurrences as occurrence
      on occurrence.family_id = reminder.family_id
      and occurrence.id = reminder.scheduled_service_occurrence_id
    left join public.scheduled_services as scheduled_service
      on scheduled_service.family_id = occurrence.family_id
      and scheduled_service.id = occurrence.scheduled_service_id
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
            document.family_id, document.property_id, document.vehicle_id
          )
        )
        or (
          vehicle_service.id is not null
          and vehicle_service.status <> 'cancelled'
          and service_vehicle.status = 'active'
        )
        or (
          mileage_vehicle.id is not null
          and mileage_vehicle.status = 'active'
        )
        or (
          occurrence.id is not null
          and occurrence.status = 'pending'
          and scheduled_service.status = 'active'
        )
      )
    order by reminder.scheduled_for
    for update of reminder skip locked
    limit batch_size
  loop
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
      reminder_id, recipient_user_id, occurrence_at
    ) do nothing;

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

revoke all on function public.calculate_scheduled_service_next_due_date(
  date, text, smallint
) from public, anon, authenticated;
revoke all on function public.create_scheduled_service(
  uuid, uuid, uuid, uuid, text, text, text, text, smallint, date,
  smallint, smallint, text
) from public, anon, authenticated;
revoke all on function public.update_scheduled_service(
  uuid, uuid, text, text, text, text, smallint, date, smallint,
  smallint, text, bigint
) from public, anon, authenticated;
revoke all on function public.resolve_scheduled_service_occurrence(
  uuid, text, bigint
) from public, anon, authenticated;
revoke all on function public.cancel_scheduled_service(
  uuid, bigint
) from public, anon, authenticated;

grant execute on function public.create_scheduled_service(
  uuid, uuid, uuid, uuid, text, text, text, text, smallint, date,
  smallint, smallint, text
) to authenticated;
grant execute on function public.update_scheduled_service(
  uuid, uuid, text, text, text, text, smallint, date, smallint,
  smallint, text, bigint
) to authenticated;
grant execute on function public.resolve_scheduled_service_occurrence(
  uuid, text, bigint
) to authenticated;
grant execute on function public.cancel_scheduled_service(
  uuid, bigint
) to authenticated;
