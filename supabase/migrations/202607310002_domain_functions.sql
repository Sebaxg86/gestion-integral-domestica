create or replace function public.require_authenticated_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesión válida.';
  end if;

  return current_user_id;
end;
$$;

create or replace function public.require_family_owner(target_family_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
begin
  if not exists (
    select 1
    from public.families
    where id = target_family_id
      and owner_user_id = current_user_id
  ) then
    raise exception using errcode = 'P0002', message = 'El recurso no existe.';
  end if;

  return current_user_id;
end;
$$;

create or replace function public.is_valid_timezone(timezone_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = timezone_name
  );
$$;

create or replace function public.calculate_reminder_time(
  expiration_date date,
  lead_days smallint,
  timezone_name text
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select ((expiration_date - lead_days::integer) + time '09:00') at time zone timezone_name;
$$;

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
    select
      reminder.id,
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
      and reminder.status = 'scheduled'
      and reminder.scheduled_for <= statement_timestamp()
      and document.status = 'active'
      and property.status = 'active'
    order by reminder.scheduled_for
    for update of reminder skip locked
    limit batch_size
  loop
    insert into public.notifications (
      family_id, reminder_id, recipient_user_id, title, message
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
      )
    ) on conflict (reminder_id, recipient_user_id) do nothing;

    update public.reminders
    set status = 'notified',
        notified_at = statement_timestamp(),
        updated_by_user_id = due_reminder.owner_user_id
    where id = due_reminder.id and status = 'scheduled';

    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$$;

create or replace function public.update_profile(
  profile_full_name text,
  expected_version bigint
)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  updated_profile public.users;
begin
  update public.users
  set full_name = trim(profile_full_name)
  where id = current_user_id
    and version = expected_version
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception using errcode = '40001', message = 'El perfil cambió en otra sesión. Actualiza e intenta de nuevo.';
  end if;

  return updated_profile;
end;
$$;

create or replace function public.create_family(
  family_id uuid,
  family_name text,
  family_timezone text
)
returns public.families
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  created_family public.families;
  existing_family public.families;
begin
  if not exists (
    select 1 from public.users
    where id = current_user_id and email_verified_at is not null
  ) then
    raise exception using errcode = '42501', message = 'Verifica tu correo antes de crear una familia.';
  end if;

  if not public.is_valid_timezone(family_timezone) then
    raise exception using errcode = '22023', message = 'La zona horaria no es válida.';
  end if;

  select * into existing_family
  from public.families
  where id = family_id or owner_user_id = current_user_id
  limit 1;

  if existing_family.id is not null then
    if existing_family.id = family_id
      and existing_family.owner_user_id = current_user_id
      and existing_family.name = trim(family_name)
      and existing_family.timezone = family_timezone then
      return existing_family;
    end if;

    raise exception using errcode = '23505', message = 'La cuenta ya tiene una familia o el identificador está en uso.';
  end if;

  insert into public.families (id, owner_user_id, name, timezone)
  values (family_id, current_user_id, trim(family_name), family_timezone)
  returning * into created_family;

  return created_family;
end;
$$;

create or replace function public.update_family(
  target_family_id uuid,
  family_name text,
  family_timezone text,
  expected_version bigint
)
returns public.families
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_family_owner(target_family_id);
  updated_family public.families;
begin
  if not public.is_valid_timezone(family_timezone) then
    raise exception using errcode = '22023', message = 'La zona horaria no es válida.';
  end if;

  update public.families
  set name = trim(family_name),
      timezone = family_timezone
  where id = target_family_id
    and owner_user_id = current_user_id
    and version = expected_version
  returning * into updated_family;

  if updated_family.id is null then
    raise exception using errcode = '40001', message = 'La familia cambió en otra sesión. Actualiza e intenta de nuevo.';
  end if;

  update public.reminders as reminder
  set scheduled_for = public.calculate_reminder_time(
        document.expiration_date,
        reminder.lead_days,
        updated_family.timezone
      ),
      updated_by_user_id = current_user_id
  from public.documents as document
  where reminder.family_id = target_family_id
    and reminder.document_id = document.id
    and reminder.status = 'scheduled';

  perform public.notify_due_reminders_for_family(target_family_id, 500);

  return updated_family;
end;
$$;

create or replace function public.create_property(
  property_id uuid,
  target_family_id uuid,
  property_name text,
  property_type text,
  property_address text default null
)
returns public.properties
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_family_owner(target_family_id);
  created_property public.properties;
  existing_property public.properties;
begin
  select * into existing_property from public.properties where id = property_id;

  if existing_property.id is not null then
    if existing_property.family_id = target_family_id
      and existing_property.created_by_user_id = current_user_id
      and existing_property.name = trim(property_name)
      and existing_property.type = property_type
      and existing_property.address is not distinct from nullif(trim(property_address), '') then
      return existing_property;
    end if;

    raise exception using errcode = '23505', message = 'El identificador de la vivienda ya está en uso.';
  end if;

  insert into public.properties (
    id, family_id, name, type, address, created_by_user_id, updated_by_user_id
  ) values (
    property_id,
    target_family_id,
    trim(property_name),
    property_type,
    nullif(trim(property_address), ''),
    current_user_id,
    current_user_id
  )
  returning * into created_property;

  return created_property;
end;
$$;

create or replace function public.update_property(
  target_property_id uuid,
  property_name text,
  property_type text,
  property_address text,
  expected_version bigint
)
returns public.properties
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  updated_property public.properties;
begin
  update public.properties as property
  set name = trim(property_name),
      type = property_type,
      address = nullif(trim(property_address), ''),
      updated_by_user_id = current_user_id
  from public.families as family
  where property.id = target_property_id
    and property.family_id = family.id
    and family.owner_user_id = current_user_id
    and property.status = 'active'
    and property.version = expected_version
  returning property.* into updated_property;

  if updated_property.id is null then
    raise exception using errcode = 'P0002', message = 'La vivienda no existe, está archivada o cambió en otra sesión.';
  end if;

  return updated_property;
end;
$$;

create or replace function public.set_property_archived(
  target_property_id uuid,
  archive boolean,
  expected_version bigint
)
returns public.properties
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  updated_property public.properties;
begin
  update public.properties as property
  set status = case when archive then 'archived' else 'active' end,
      archived_at = case when archive then statement_timestamp() else null end,
      updated_by_user_id = current_user_id
  from public.families as family
  where property.id = target_property_id
    and property.family_id = family.id
    and family.owner_user_id = current_user_id
    and property.status = case when archive then 'active' else 'archived' end
    and property.version = expected_version
  returning property.* into updated_property;

  if updated_property.id is null then
    raise exception using errcode = 'P0002', message = 'La vivienda no existe, su estado no permite la acción o cambió en otra sesión.';
  end if;

  if archive then
    update public.reminders as reminder
    set status = 'cancelled',
        cancelled_at = statement_timestamp(),
        attended_at = null,
        updated_by_user_id = current_user_id
    from public.documents as document
    where document.property_id = target_property_id
      and document.family_id = updated_property.family_id
      and reminder.family_id = document.family_id
      and reminder.document_id = document.id
      and reminder.status in ('scheduled', 'notified');
  end if;

  return updated_property;
end;
$$;

create or replace function public.finalize_document_upload(
  actor_user_id uuid,
  document_id uuid,
  file_id uuid,
  target_family_id uuid,
  target_property_id uuid,
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
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'La operación requiere el proceso seguro de archivos.';
  end if;

  if not exists (
    select 1 from public.families
    where id = target_family_id and owner_user_id = actor_user_id
  ) then
    raise exception using errcode = 'P0002', message = 'El recurso no existe.';
  end if;

  if not exists (
    select 1 from public.properties
    where id = target_property_id
      and family_id = target_family_id
      and status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'La vivienda no existe o está archivada.';
  end if;

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
      and existing_document.property_id = target_property_id
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

  insert into public.documents (
    id,
    family_id,
    property_id,
    name,
    category,
    issue_date,
    expiration_date,
    issuer,
    document_number,
    notes,
    created_by_user_id,
    updated_by_user_id
  ) values (
    document_id,
    target_family_id,
    target_property_id,
    trim(document_name),
    document_category,
    document_issue_date,
    document_expiration_date,
    nullif(trim(document_issuer), ''),
    nullif(trim(document_number_value), ''),
    nullif(trim(document_notes), ''),
    actor_user_id,
    actor_user_id
  ) returning * into created_document;

  insert into public.document_files (
    id,
    family_id,
    document_id,
    storage_key,
    original_filename,
    detected_mime_type,
    size_bytes,
    sha256,
    created_by_user_id
  ) values (
    file_id,
    target_family_id,
    document_id,
    file_storage_key,
    trim(file_original_filename),
    file_detected_mime_type,
    file_size_bytes,
    lower(file_sha256),
    actor_user_id
  );

  return created_document;
end;
$$;

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
  update public.documents as document
  set name = trim(document_name),
      category = document_category,
      issue_date = document_issue_date,
      expiration_date = document_expiration_date,
      issuer = nullif(trim(document_issuer), ''),
      document_number = nullif(trim(document_number_value), ''),
      notes = nullif(trim(document_notes), ''),
      updated_by_user_id = current_user_id
  from public.properties as property, public.families as family
  where document.id = target_document_id
    and document.family_id = property.family_id
    and document.property_id = property.id
    and document.family_id = family.id
    and family.owner_user_id = current_user_id
    and document.status = 'active'
    and property.status = 'active'
    and document.version = expected_version
  returning document.* into updated_document;

  if updated_document.id is null then
    raise exception using errcode = 'P0002', message = 'El documento no existe, está archivado o cambió en otra sesión.';
  end if;

  select timezone into family_timezone
  from public.families
  where id = updated_document.family_id;

  if updated_document.expiration_date is null then
    update public.reminders
    set status = 'cancelled',
        cancelled_at = statement_timestamp(),
        updated_by_user_id = current_user_id
    where document_id = updated_document.id
      and family_id = updated_document.family_id
      and status = 'scheduled';
  else
    update public.reminders
    set scheduled_for = public.calculate_reminder_time(
          updated_document.expiration_date,
          lead_days,
          family_timezone
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

create or replace function public.set_document_archived(
  target_document_id uuid,
  archive boolean,
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
begin
  update public.documents as document
  set status = case when archive then 'archived' else 'active' end,
      archived_at = case when archive then statement_timestamp() else null end,
      updated_by_user_id = current_user_id
  from public.families as family
  where document.id = target_document_id
    and document.family_id = family.id
    and family.owner_user_id = current_user_id
    and document.status = case when archive then 'active' else 'archived' end
    and document.version = expected_version
  returning document.* into updated_document;

  if updated_document.id is null then
    raise exception using errcode = 'P0002', message = 'El documento no existe, su estado no permite la acción o cambió en otra sesión.';
  end if;

  if archive then
    update public.reminders
    set status = 'cancelled',
        cancelled_at = statement_timestamp(),
        attended_at = null,
        updated_by_user_id = current_user_id
    where document_id = updated_document.id
      and family_id = updated_document.family_id
      and status in ('scheduled', 'notified');
  end if;

  return updated_document;
end;
$$;

create or replace function public.create_reminder(
  reminder_id uuid,
  target_document_id uuid,
  reminder_lead_days smallint
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
  select document, family.timezone
  into document_record, family_timezone
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

  select * into existing_reminder from public.reminders
  where id = reminder_id;

  if existing_reminder.id is not null then
    if existing_reminder.document_id = target_document_id
      and existing_reminder.family_id = document_record.family_id
      and existing_reminder.lead_days = reminder_lead_days then
      return existing_reminder;
    end if;

    raise exception using errcode = '23505', message = 'El identificador del recordatorio ya está en uso.';
  end if;

  insert into public.reminders (
    id,
    family_id,
    document_id,
    lead_days,
    scheduled_for,
    created_by_user_id,
    updated_by_user_id
  ) values (
    reminder_id,
    document_record.family_id,
    document_record.id,
    reminder_lead_days,
    public.calculate_reminder_time(document_record.expiration_date, reminder_lead_days, family_timezone),
    current_user_id,
    current_user_id
  ) returning * into created_reminder;

  perform public.notify_due_reminders_for_family(document_record.family_id, 1);
  select * into created_reminder from public.reminders where id = reminder_id;

  return created_reminder;
end;
$$;

create or replace function public.update_reminder(
  target_reminder_id uuid,
  reminder_lead_days smallint,
  expected_version bigint
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
  update public.reminders as reminder
  set lead_days = reminder_lead_days,
      scheduled_for = public.calculate_reminder_time(
        document.expiration_date,
        reminder_lead_days,
        family.timezone
      ),
      updated_by_user_id = current_user_id
  from public.documents as document,
       public.properties as property,
       public.families as family
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

  perform public.notify_due_reminders_for_family(updated_reminder.family_id, 1);
  select * into updated_reminder from public.reminders where id = target_reminder_id;

  return updated_reminder;
end;
$$;

create or replace function public.cancel_reminder(
  target_reminder_id uuid,
  expected_version bigint
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
  select reminder.* into updated_reminder
  from public.reminders as reminder
  join public.families as family on family.id = reminder.family_id
  where reminder.id = target_reminder_id
    and family.owner_user_id = current_user_id;

  if updated_reminder.status = 'cancelled' then
    return updated_reminder;
  end if;

  update public.reminders as reminder
  set status = 'cancelled',
      cancelled_at = statement_timestamp(),
      attended_at = null,
      updated_by_user_id = current_user_id
  from public.families as family
  where reminder.id = target_reminder_id
    and reminder.family_id = family.id
    and family.owner_user_id = current_user_id
    and reminder.status in ('scheduled', 'notified')
    and reminder.version = expected_version
  returning reminder.* into updated_reminder;

  if updated_reminder.id is null then
    raise exception using errcode = 'P0002', message = 'El recordatorio no existe, su estado no permite la acción o cambió en otra sesión.';
  end if;

  return updated_reminder;
end;
$$;

create or replace function public.attend_reminder(
  target_reminder_id uuid,
  expected_version bigint
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
  select reminder.* into updated_reminder
  from public.reminders as reminder
  join public.families as family on family.id = reminder.family_id
  where reminder.id = target_reminder_id
    and family.owner_user_id = current_user_id;

  if updated_reminder.status = 'attended' then
    return updated_reminder;
  end if;

  update public.reminders as reminder
  set status = 'attended',
      attended_at = statement_timestamp(),
      cancelled_at = null,
      updated_by_user_id = current_user_id
  from public.families as family
  where reminder.id = target_reminder_id
    and reminder.family_id = family.id
    and family.owner_user_id = current_user_id
    and reminder.status = 'notified'
    and reminder.version = expected_version
  returning reminder.* into updated_reminder;

  if updated_reminder.id is null then
    raise exception using errcode = 'P0002', message = 'El recordatorio no existe, no fue notificado o cambió en otra sesión.';
  end if;

  return updated_reminder;
end;
$$;

create or replace function public.mark_notification_read(target_notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  updated_notification public.notifications;
begin
  update public.notifications
  set status = 'read',
      read_at = coalesce(read_at, statement_timestamp())
  where id = target_notification_id
    and recipient_user_id = current_user_id
  returning * into updated_notification;

  if updated_notification.id is null then
    raise exception using errcode = 'P0002', message = 'La notificación no existe.';
  end if;

  return updated_notification;
end;
$$;

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
    select
      reminder.id,
      reminder.family_id,
      reminder.document_id,
      family.owner_user_id,
      document.name as document_name,
      document.expiration_date
    from public.reminders as reminder
    join public.documents as document
      on document.family_id = reminder.family_id and document.id = reminder.document_id
    join public.properties as property
      on property.family_id = document.family_id and property.id = document.property_id
    join public.families as family on family.id = reminder.family_id
    where reminder.status = 'scheduled'
      and reminder.scheduled_for <= statement_timestamp()
      and document.status = 'active'
      and property.status = 'active'
    order by reminder.scheduled_for
    for update of reminder skip locked
    limit batch_size
  loop
    insert into public.notifications (
      family_id,
      reminder_id,
      recipient_user_id,
      title,
      message
    ) values (
      due_reminder.family_id,
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
      )
    ) on conflict (reminder_id, recipient_user_id) do nothing;

    update public.reminders
    set status = 'notified',
        notified_at = statement_timestamp(),
        updated_by_user_id = due_reminder.owner_user_id
    where id = due_reminder.id
      and status = 'scheduled';

    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$$;

alter default privileges in schema public revoke execute on functions from public;

revoke all on function public.require_authenticated_user() from public, anon, authenticated;
revoke all on function public.require_family_owner(uuid) from public, anon, authenticated;
revoke all on function public.is_valid_timezone(text) from public, anon, authenticated;
revoke all on function public.calculate_reminder_time(date, smallint, text) from public, anon, authenticated;
revoke all on function public.notify_due_reminders_for_family(uuid, integer) from public, anon, authenticated;
revoke all on function public.update_profile(text, bigint) from public, anon, authenticated;
revoke all on function public.create_family(uuid, text, text) from public, anon, authenticated;
revoke all on function public.update_family(uuid, text, text, bigint) from public, anon, authenticated;
revoke all on function public.create_property(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.update_property(uuid, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.set_property_archived(uuid, boolean, bigint) from public, anon, authenticated;
revoke all on function public.finalize_document_upload(
  uuid, uuid, uuid, uuid, uuid, text, text, date, date, text, text, text,
  text, text, text, bigint, text
) from public, anon, authenticated;
revoke all on function public.update_document(uuid, text, text, date, date, text, text, text, bigint)
  from public, anon, authenticated;
revoke all on function public.set_document_archived(uuid, boolean, bigint) from public, anon, authenticated;
revoke all on function public.create_reminder(uuid, uuid, smallint) from public, anon, authenticated;
revoke all on function public.update_reminder(uuid, smallint, bigint) from public, anon, authenticated;
revoke all on function public.cancel_reminder(uuid, bigint) from public, anon, authenticated;
revoke all on function public.attend_reminder(uuid, bigint) from public, anon, authenticated;
revoke all on function public.mark_notification_read(uuid) from public, anon, authenticated;
revoke all on function public.process_due_reminders(integer) from public, anon, authenticated;

grant execute on function public.update_profile(text, bigint) to authenticated;
grant execute on function public.create_family(uuid, text, text) to authenticated;
grant execute on function public.update_family(uuid, text, text, bigint) to authenticated;
grant execute on function public.create_property(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.update_property(uuid, text, text, text, bigint) to authenticated;
grant execute on function public.set_property_archived(uuid, boolean, bigint) to authenticated;
grant execute on function public.update_document(uuid, text, text, date, date, text, text, text, bigint) to authenticated;
grant execute on function public.set_document_archived(uuid, boolean, bigint) to authenticated;
grant execute on function public.create_reminder(uuid, uuid, smallint) to authenticated;
grant execute on function public.update_reminder(uuid, smallint, bigint) to authenticated;
grant execute on function public.cancel_reminder(uuid, bigint) to authenticated;
grant execute on function public.attend_reminder(uuid, bigint) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;

grant execute on function public.finalize_document_upload(
  uuid, uuid, uuid, uuid, uuid, text, text, date, date, text, text, text,
  text, text, text, bigint, text
) to service_role;
grant execute on function public.process_due_reminders(integer) to service_role;
