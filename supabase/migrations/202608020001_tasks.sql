-- ============================================================================
-- Pendientes familiares
-- ============================================================================

-- ===== Registro operativo y relaciones opcionales =====

create table public.tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  property_id uuid,
  vehicle_id uuid,
  scheduled_service_id uuid,
  title varchar(150) not null,
  description varchar(3000),
  category varchar(30) not null,
  priority varchar(20) not null default 'normal',
  due_date date,
  reminder_lead_days smallint,
  reminder_repeat_interval_days smallint,
  status varchar(20) not null default 'pending',
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1,
  constraint tasks_family_id_unique unique (family_id, id),
  constraint tasks_property_fk foreign key (family_id, property_id)
    references public.properties (family_id, id) on delete restrict,
  constraint tasks_vehicle_fk foreign key (family_id, vehicle_id)
    references public.vehicles (family_id, id) on delete restrict,
  constraint tasks_scheduled_service_fk
    foreign key (family_id, scheduled_service_id)
    references public.scheduled_services (family_id, id) on delete restrict,
  constraint tasks_created_by_owner_fk
    foreign key (family_id, created_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint tasks_updated_by_owner_fk
    foreign key (family_id, updated_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint tasks_single_target check (
    num_nonnulls(property_id, vehicle_id, scheduled_service_id) <= 1
  ),
  constraint tasks_title_length check (
    char_length(trim(title)) between 2 and 150
  ),
  constraint tasks_description_length check (
    description is null or char_length(description) <= 3000
  ),
  constraint tasks_category_allowed check (category in (
    'household', 'maintenance', 'paperwork', 'purchase',
    'call', 'appointment', 'other'
  )),
  constraint tasks_priority_allowed check (
    priority in ('low', 'normal', 'high')
  ),
  constraint tasks_reminder_lead_days_allowed check (
    reminder_lead_days is null
    or reminder_lead_days in (0, 1, 3, 7, 15, 30)
  ),
  constraint tasks_reminder_repeat_allowed check (
    reminder_repeat_interval_days is null
    or reminder_repeat_interval_days in (1, 7)
  ),
  constraint tasks_reminder_consistent check (
    (
      reminder_lead_days is null
      and reminder_repeat_interval_days is null
    )
    or (
      due_date is not null
      and reminder_lead_days is not null
    )
  ),
  constraint tasks_status_allowed check (
    status in ('pending', 'in_progress', 'completed', 'cancelled')
  ),
  constraint tasks_status_dates_consistent check (
    (status in ('pending', 'in_progress')
      and completed_at is null and cancelled_at is null)
    or (status = 'completed'
      and completed_at is not null and cancelled_at is null)
    or (status = 'cancelled'
      and completed_at is null and cancelled_at is not null)
  ),
  constraint tasks_version_positive check (version >= 1)
);

create index tasks_family_status_due_idx
  on public.tasks (family_id, status, due_date, priority);
create index tasks_property_idx
  on public.tasks (family_id, property_id)
  where property_id is not null;
create index tasks_vehicle_idx
  on public.tasks (family_id, vehicle_id)
  where vehicle_id is not null;
create index tasks_scheduled_service_idx
  on public.tasks (family_id, scheduled_service_id)
  where scheduled_service_id is not null;

create trigger tasks_set_updated_fields
before update on public.tasks
for each row execute function public.set_updated_fields();

-- ===== Recordatorios asociados con pendientes =====

alter table public.reminders
  add column task_id uuid,
  add constraint reminders_task_fk foreign key (family_id, task_id)
    references public.tasks (family_id, id) on delete restrict;

alter table public.reminders
  drop constraint reminders_single_target,
  add constraint reminders_single_target check (
    num_nonnulls(
      document_id,
      vehicle_service_id,
      vehicle_id,
      scheduled_service_occurrence_id,
      task_id
    ) = 1
  );

create unique index reminders_one_open_task_idx
  on public.reminders (family_id, task_id)
  where task_id is not null and status in ('scheduled', 'notified');

-- ===== Lectura segura y escritura mediante funciones =====

alter table public.tasks enable row level security;

revoke all on public.tasks from anon, authenticated;
grant select on public.tasks to authenticated;

create policy tasks_select_owned on public.tasks
for select to authenticated
using (exists (
  select 1 from public.families
  where families.id = tasks.family_id
    and families.owner_user_id = (select auth.uid())
));

-- ===== Validación reutilizable del elemento relacionado =====

create function public.is_valid_task_target(
  target_family_id uuid,
  target_property_id uuid,
  target_vehicle_id uuid,
  target_scheduled_service_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    num_nonnulls(
      target_property_id,
      target_vehicle_id,
      target_scheduled_service_id
    ) <= 1
    and (
      target_property_id is null
      or exists (
        select 1 from public.properties as property
        where property.family_id = target_family_id
          and property.id = target_property_id
          and property.status = 'active'
      )
    )
    and (
      target_vehicle_id is null
      or exists (
        select 1 from public.vehicles as vehicle
        where vehicle.family_id = target_family_id
          and vehicle.id = target_vehicle_id
          and vehicle.status = 'active'
      )
    )
    and (
      target_scheduled_service_id is null
      or exists (
        select 1 from public.scheduled_services as service
        where service.family_id = target_family_id
          and service.id = target_scheduled_service_id
          and service.status = 'active'
      )
    );
$$;

-- ===== Creación del pendiente =====

create function public.create_task(
  task_id uuid,
  target_family_id uuid,
  target_property_id uuid,
  target_vehicle_id uuid,
  target_scheduled_service_id uuid,
  task_title text,
  task_description text,
  task_category text,
  task_priority text,
  task_due_date date,
  task_reminder_lead_days smallint,
  task_reminder_repeat_interval_days smallint
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  family_timezone text;
  created_task public.tasks;
begin
  -- ===== Validación de propiedad y relaciones =====

  select family.timezone into family_timezone
  from public.families as family
  where family.id = target_family_id
    and family.owner_user_id = current_user_id;

  if family_timezone is null then
    raise exception using errcode = 'P0002', message = 'La familia no existe.';
  end if;

  if not public.is_valid_task_target(
    target_family_id,
    target_property_id,
    target_vehicle_id,
    target_scheduled_service_id
  ) then
    raise exception using errcode = 'P0002', message = 'El elemento relacionado no existe o está archivado.';
  end if;

  -- ===== Persistencia del pendiente =====

  insert into public.tasks (
    id, family_id, property_id, vehicle_id, scheduled_service_id,
    title, description, category, priority, due_date,
    reminder_lead_days, reminder_repeat_interval_days,
    created_by_user_id, updated_by_user_id
  ) values (
    task_id, target_family_id, target_property_id, target_vehicle_id,
    target_scheduled_service_id, trim(task_title),
    nullif(trim(task_description), ''), task_category, task_priority,
    task_due_date, task_reminder_lead_days,
    task_reminder_repeat_interval_days,
    current_user_id, current_user_id
  ) returning * into created_task;

  -- ===== Programación opcional del aviso =====

  if task_due_date is not null and task_reminder_lead_days is not null then
    insert into public.reminders (
      family_id, task_id, lead_days, repeat_interval_days, scheduled_for,
      created_by_user_id, updated_by_user_id
    ) values (
      target_family_id, created_task.id, task_reminder_lead_days,
      task_reminder_repeat_interval_days,
      public.calculate_reminder_time(
        task_due_date, task_reminder_lead_days, family_timezone
      ),
      current_user_id, current_user_id
    );

    perform public.notify_due_reminders_for_family(target_family_id, 1);
  end if;

  return created_task;
end;
$$;

-- ===== Edición de un pendiente activo =====

create function public.update_task(
  target_task_id uuid,
  target_property_id uuid,
  target_vehicle_id uuid,
  target_scheduled_service_id uuid,
  task_title text,
  task_description text,
  task_category text,
  task_priority text,
  task_due_date date,
  task_reminder_lead_days smallint,
  task_reminder_repeat_interval_days smallint,
  expected_version bigint
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  current_task public.tasks;
  updated_task public.tasks;
  family_timezone text;
begin
  -- ===== Consulta protegida del registro actual =====

  select task.* into current_task
  from public.tasks as task
  join public.families as family on family.id = task.family_id
  where task.id = target_task_id
    and family.owner_user_id = current_user_id
    and task.status in ('pending', 'in_progress')
    and task.version = expected_version
  for update of task;

  if current_task.id is null then
    raise exception using errcode = 'P0002', message = 'El pendiente no existe o cambió en otra sesión.';
  end if;

  if not public.is_valid_task_target(
    current_task.family_id,
    target_property_id,
    target_vehicle_id,
    target_scheduled_service_id
  ) then
    raise exception using errcode = 'P0002', message = 'El elemento relacionado no existe o está archivado.';
  end if;

  -- ===== Cierre del aviso anterior =====

  update public.notifications as notification
  set status = 'read', read_at = coalesce(read_at, statement_timestamp())
  from public.reminders as reminder
  where reminder.family_id = current_task.family_id
    and reminder.task_id = current_task.id
    and notification.family_id = reminder.family_id
    and notification.reminder_id = reminder.id
    and notification.status = 'unread';

  update public.reminders
  set status = 'cancelled', cancelled_at = statement_timestamp(),
      attended_at = null, updated_by_user_id = current_user_id
  where family_id = current_task.family_id
    and task_id = current_task.id
    and status in ('scheduled', 'notified');

  -- ===== Persistencia de la nueva configuración =====

  update public.tasks
  set property_id = target_property_id,
      vehicle_id = target_vehicle_id,
      scheduled_service_id = target_scheduled_service_id,
      title = trim(task_title),
      description = nullif(trim(task_description), ''),
      category = task_category,
      priority = task_priority,
      due_date = task_due_date,
      reminder_lead_days = task_reminder_lead_days,
      reminder_repeat_interval_days = task_reminder_repeat_interval_days,
      updated_by_user_id = current_user_id
  where id = current_task.id
  returning * into updated_task;

  -- ===== Programación del aviso actualizado =====

  if task_due_date is not null and task_reminder_lead_days is not null then
    select family.timezone into family_timezone
    from public.families as family
    where family.id = updated_task.family_id;

    insert into public.reminders (
      family_id, task_id, lead_days, repeat_interval_days, scheduled_for,
      created_by_user_id, updated_by_user_id
    ) values (
      updated_task.family_id, updated_task.id, task_reminder_lead_days,
      task_reminder_repeat_interval_days,
      public.calculate_reminder_time(
        task_due_date, task_reminder_lead_days, family_timezone
      ),
      current_user_id, current_user_id
    );

    perform public.notify_due_reminders_for_family(updated_task.family_id, 1);
  end if;

  return updated_task;
end;
$$;

-- ===== Cambio de estado y reapertura =====

create function public.set_task_status(
  target_task_id uuid,
  task_status text,
  expected_version bigint
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  updated_task public.tasks;
  family_timezone text;
begin
  -- ===== Validación y persistencia del estado =====

  if task_status not in ('pending', 'in_progress', 'completed', 'cancelled') then
    raise exception using errcode = '22023', message = 'El estado no es válido.';
  end if;

  update public.tasks as task
  set status = task_status,
      completed_at = case
        when task_status = 'completed' then statement_timestamp()
        else null
      end,
      cancelled_at = case
        when task_status = 'cancelled' then statement_timestamp()
        else null
      end,
      updated_by_user_id = current_user_id
  from public.families as family
  where task.id = target_task_id
    and task.family_id = family.id
    and family.owner_user_id = current_user_id
    and task.version = expected_version
    and task.status <> task_status
  returning task.* into updated_task;

  if updated_task.id is null then
    raise exception using errcode = 'P0002', message = 'El pendiente no existe, ya tiene ese estado o cambió en otra sesión.';
  end if;

  -- ===== Cierre de avisos al finalizar =====

  if task_status in ('completed', 'cancelled') then
    update public.notifications as notification
    set status = 'read', read_at = coalesce(read_at, statement_timestamp())
    from public.reminders as reminder
    where reminder.family_id = updated_task.family_id
      and reminder.task_id = updated_task.id
      and notification.family_id = reminder.family_id
      and notification.reminder_id = reminder.id
      and notification.status = 'unread';

    if task_status = 'completed' then
      update public.reminders
      set status = 'attended',
          notified_at = coalesce(notified_at, statement_timestamp()),
          attended_at = statement_timestamp(), cancelled_at = null,
          updated_by_user_id = current_user_id
      where family_id = updated_task.family_id
        and task_id = updated_task.id
        and status in ('scheduled', 'notified');
    else
      update public.reminders
      set status = 'cancelled', cancelled_at = statement_timestamp(),
          attended_at = null, updated_by_user_id = current_user_id
      where family_id = updated_task.family_id
        and task_id = updated_task.id
        and status in ('scheduled', 'notified');
    end if;
  end if;

  -- ===== Restauración del aviso al reabrir =====

  if task_status in ('pending', 'in_progress')
    and updated_task.due_date is not null
    and updated_task.reminder_lead_days is not null
    and not exists (
      select 1 from public.reminders as reminder
      where reminder.family_id = updated_task.family_id
        and reminder.task_id = updated_task.id
        and reminder.status in ('scheduled', 'notified')
    ) then
    select family.timezone into family_timezone
    from public.families as family
    where family.id = updated_task.family_id;

    insert into public.reminders (
      family_id, task_id, lead_days, repeat_interval_days, scheduled_for,
      created_by_user_id, updated_by_user_id
    ) values (
      updated_task.family_id, updated_task.id,
      updated_task.reminder_lead_days,
      updated_task.reminder_repeat_interval_days,
      public.calculate_reminder_time(
        updated_task.due_date,
        updated_task.reminder_lead_days,
        family_timezone
      ),
      current_user_id, current_user_id
    );

    perform public.notify_due_reminders_for_family(updated_task.family_id, 1);
  end if;

  return updated_task;
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
        scheduled_service.name,
        task.title
      ) as target_name,
      coalesce(
        document.expiration_date,
        vehicle_service.next_due_date,
        occurrence.due_date,
        task.due_date,
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
    left join public.tasks as task
      on task.family_id = reminder.family_id
      and task.id = reminder.task_id
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
        or (
          task.id is not null
          and task.status in ('pending', 'in_progress')
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

revoke all on function public.is_valid_task_target(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated;
revoke all on function public.create_task(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, date,
  smallint, smallint
) from public, anon, authenticated;
revoke all on function public.update_task(
  uuid, uuid, uuid, uuid, text, text, text, text, date,
  smallint, smallint, bigint
) from public, anon, authenticated;
revoke all on function public.set_task_status(
  uuid, text, bigint
) from public, anon, authenticated;

grant execute on function public.create_task(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, date,
  smallint, smallint
) to authenticated;
grant execute on function public.update_task(
  uuid, uuid, uuid, uuid, text, text, text, text, date,
  smallint, smallint, bigint
) to authenticated;
grant execute on function public.set_task_status(
  uuid, text, bigint
) to authenticated;
