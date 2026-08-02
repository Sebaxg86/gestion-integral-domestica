-- ============================================================================
-- Detalle de trabajos, refacciones y adjuntos de mantenimiento
-- ============================================================================

-- ===== Trabajos realizados o detectados =====

create table public.vehicle_service_items (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  vehicle_service_id uuid not null,
  category varchar(30) not null,
  description varchar(150) not null,
  status varchar(20) not null,
  notes varchar(1500),
  warranty_until date,
  archived_at timestamptz,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1,
  constraint vehicle_service_items_family_id_unique unique (family_id, id),
  constraint vehicle_service_items_service_id_unique
    unique (family_id, vehicle_service_id, id),
  constraint vehicle_service_items_service_fk
    foreign key (family_id, vehicle_service_id)
    references public.vehicle_services (family_id, id) on delete restrict,
  constraint vehicle_service_items_created_by_owner_fk
    foreign key (family_id, created_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint vehicle_service_items_updated_by_owner_fk
    foreign key (family_id, updated_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint vehicle_service_items_category_allowed check (category in (
    'oil', 'brakes', 'suspension', 'battery', 'tires', 'fluids', 'filters',
    'engine', 'transmission', 'electrical', 'body', 'inspection', 'other'
  )),
  constraint vehicle_service_items_description_length check (
    char_length(trim(description)) between 2 and 150
  ),
  constraint vehicle_service_items_status_allowed check (
    status in ('reviewed', 'completed', 'pending')
  ),
  constraint vehicle_service_items_notes_length check (
    notes is null or char_length(notes) <= 1500
  ),
  constraint vehicle_service_items_version_positive check (version >= 1)
);

create index vehicle_service_items_service_idx
  on public.vehicle_service_items (family_id, vehicle_service_id, created_at)
  where archived_at is null;

create trigger vehicle_service_items_set_updated_fields
before update on public.vehicle_service_items
for each row execute function public.set_updated_fields();

-- ===== Refacciones utilizadas =====

create table public.vehicle_service_parts (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  vehicle_service_id uuid not null,
  vehicle_service_item_id uuid,
  name varchar(150) not null,
  brand varchar(100),
  part_number varchar(100),
  quantity numeric(10, 2) not null default 1,
  unit_cost numeric(12, 2),
  warranty_until date,
  notes varchar(1000),
  archived_at timestamptz,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1,
  constraint vehicle_service_parts_family_id_unique unique (family_id, id),
  constraint vehicle_service_parts_service_fk
    foreign key (family_id, vehicle_service_id)
    references public.vehicle_services (family_id, id) on delete restrict,
  constraint vehicle_service_parts_item_fk
    foreign key (family_id, vehicle_service_id, vehicle_service_item_id)
    references public.vehicle_service_items (family_id, vehicle_service_id, id)
    on delete restrict,
  constraint vehicle_service_parts_created_by_owner_fk
    foreign key (family_id, created_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint vehicle_service_parts_updated_by_owner_fk
    foreign key (family_id, updated_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint vehicle_service_parts_name_length check (
    char_length(trim(name)) between 2 and 150
  ),
  constraint vehicle_service_parts_brand_length check (
    brand is null or char_length(brand) <= 100
  ),
  constraint vehicle_service_parts_number_length check (
    part_number is null or char_length(part_number) <= 100
  ),
  constraint vehicle_service_parts_quantity_positive check (quantity > 0),
  constraint vehicle_service_parts_unit_cost_allowed check (
    unit_cost is null or unit_cost >= 0
  ),
  constraint vehicle_service_parts_notes_length check (
    notes is null or char_length(notes) <= 1000
  ),
  constraint vehicle_service_parts_version_positive check (version >= 1)
);

create index vehicle_service_parts_service_idx
  on public.vehicle_service_parts (family_id, vehicle_service_id, created_at)
  where archived_at is null;

create trigger vehicle_service_parts_set_updated_fields
before update on public.vehicle_service_parts
for each row execute function public.set_updated_fields();

-- ===== Comprobantes y fotografías privadas =====

create table public.vehicle_service_attachments (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete restrict,
  vehicle_service_id uuid not null,
  kind varchar(20) not null,
  title varchar(150) not null,
  original_filename varchar(255) not null,
  storage_key text not null unique,
  detected_mime_type varchar(100) not null,
  size_bytes bigint not null,
  sha256 varchar(64) not null,
  status varchar(20) not null default 'active',
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1,
  constraint vehicle_service_attachments_family_id_unique unique (family_id, id),
  constraint vehicle_service_attachments_service_fk
    foreign key (family_id, vehicle_service_id)
    references public.vehicle_services (family_id, id) on delete restrict,
  constraint vehicle_service_attachments_created_by_owner_fk
    foreign key (family_id, created_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint vehicle_service_attachments_updated_by_owner_fk
    foreign key (family_id, updated_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint vehicle_service_attachments_kind_allowed check (
    kind in ('invoice', 'receipt', 'photo', 'warranty', 'other')
  ),
  constraint vehicle_service_attachments_title_length check (
    char_length(trim(title)) between 2 and 150
  ),
  constraint vehicle_service_attachments_filename_length check (
    char_length(trim(original_filename)) between 1 and 255
  ),
  constraint vehicle_service_attachments_storage_key_length check (
    char_length(storage_key) between 1 and 1000
  ),
  constraint vehicle_service_attachments_size_positive check (size_bytes > 0),
  constraint vehicle_service_attachments_sha256_format check (
    sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint vehicle_service_attachments_status_allowed check (
    status in ('active', 'archived', 'deleted')
  ),
  constraint vehicle_service_attachments_version_positive check (version >= 1)
);

create index vehicle_service_attachments_service_idx
  on public.vehicle_service_attachments (family_id, vehicle_service_id, created_at)
  where status = 'active';

create trigger vehicle_service_attachments_set_updated_fields
before update on public.vehicle_service_attachments
for each row execute function public.set_updated_fields();

-- ===== Lectura aislada por familia =====

alter table public.vehicle_service_items enable row level security;
alter table public.vehicle_service_parts enable row level security;
alter table public.vehicle_service_attachments enable row level security;

revoke all on public.vehicle_service_items from anon, authenticated;
revoke all on public.vehicle_service_parts from anon, authenticated;
revoke all on public.vehicle_service_attachments from anon, authenticated;

grant select on public.vehicle_service_items to authenticated;
grant select on public.vehicle_service_parts to authenticated;
grant select on public.vehicle_service_attachments to authenticated;

create policy vehicle_service_items_select_owned
on public.vehicle_service_items
for select to authenticated
using (exists (
  select 1 from public.families
  where families.id = vehicle_service_items.family_id
    and families.owner_user_id = (select auth.uid())
));

create policy vehicle_service_parts_select_owned
on public.vehicle_service_parts
for select to authenticated
using (exists (
  select 1 from public.families
  where families.id = vehicle_service_parts.family_id
    and families.owner_user_id = (select auth.uid())
));

create policy vehicle_service_attachments_select_owned
on public.vehicle_service_attachments
for select to authenticated
using (exists (
  select 1 from public.families
  where families.id = vehicle_service_attachments.family_id
    and families.owner_user_id = (select auth.uid())
));

-- ===== Validación compartida del servicio propietario =====

create function public.require_owned_vehicle_service(target_service_id uuid)
returns public.vehicle_services
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  service_record public.vehicle_services;
begin
  select service.* into service_record
  from public.vehicle_services as service
  join public.vehicles as vehicle
    on vehicle.id = service.vehicle_id and vehicle.family_id = service.family_id
  join public.families as family on family.id = service.family_id
  where service.id = target_service_id
    and vehicle.status = 'active'
    and family.owner_user_id = current_user_id;

  if service_record.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'El servicio no existe o su vehículo está archivado.';
  end if;

  return service_record;
end;
$$;

-- ===== Creación y actualización de trabajos =====

create function public.create_vehicle_service_item(
  target_service_id uuid,
  item_category text,
  item_description text,
  item_status text,
  item_notes text,
  item_warranty_until date
)
returns public.vehicle_service_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  service_record public.vehicle_services;
  created_item public.vehicle_service_items;
begin
  -- ===== Validación de propiedad =====

  service_record := public.require_owned_vehicle_service(target_service_id);

  -- ===== Persistencia del trabajo =====

  insert into public.vehicle_service_items (
    family_id, vehicle_service_id, category, description, status, notes,
    warranty_until, created_by_user_id, updated_by_user_id
  ) values (
    service_record.family_id, service_record.id, item_category,
    trim(item_description), item_status, nullif(trim(item_notes), ''),
    item_warranty_until, current_user_id, current_user_id
  ) returning * into created_item;

  return created_item;
end;
$$;

create function public.set_vehicle_service_item_status(
  target_item_id uuid,
  item_status text,
  expected_version bigint
)
returns public.vehicle_service_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  updated_item public.vehicle_service_items;
begin
  -- ===== Persistencia con permisos y control de versión =====

  update public.vehicle_service_items as item
  set status = item_status, updated_by_user_id = current_user_id
  from public.vehicle_services as service,
       public.vehicles as vehicle,
       public.families as family
  where item.id = target_item_id
    and item.archived_at is null
    and item.vehicle_service_id = service.id
    and item.family_id = service.family_id
    and service.vehicle_id = vehicle.id
    and service.family_id = vehicle.family_id
    and vehicle.status = 'active'
    and item.family_id = family.id
    and family.owner_user_id = current_user_id
    and item.version = expected_version
  returning item.* into updated_item;

  if updated_item.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'El trabajo no existe o cambió en otra sesión.';
  end if;

  return updated_item;
end;
$$;

create function public.archive_vehicle_service_item(
  target_item_id uuid,
  expected_version bigint
)
returns public.vehicle_service_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  archived_item public.vehicle_service_items;
begin
  -- ===== Archivado del trabajo =====

  update public.vehicle_service_items as item
  set archived_at = statement_timestamp(), updated_by_user_id = current_user_id
  from public.vehicle_services as service,
       public.vehicles as vehicle,
       public.families as family
  where item.id = target_item_id
    and item.archived_at is null
    and item.vehicle_service_id = service.id
    and item.family_id = service.family_id
    and service.vehicle_id = vehicle.id
    and service.family_id = vehicle.family_id
    and vehicle.status = 'active'
    and item.family_id = family.id
    and family.owner_user_id = current_user_id
    and item.version = expected_version
  returning item.* into archived_item;

  if archived_item.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'El trabajo no existe o cambió en otra sesión.';
  end if;

  -- ------- Ocultar también las refacciones ligadas al trabajo -------

  update public.vehicle_service_parts
  set archived_at = statement_timestamp(), updated_by_user_id = current_user_id
  where vehicle_service_item_id = archived_item.id
    and family_id = archived_item.family_id
    and archived_at is null;

  return archived_item;
end;
$$;

-- ===== Creación y archivado de refacciones =====

create function public.create_vehicle_service_part(
  target_service_id uuid,
  target_item_id uuid,
  part_name text,
  part_brand text,
  part_number_value text,
  part_quantity numeric,
  part_unit_cost numeric,
  part_warranty_until date,
  part_notes text
)
returns public.vehicle_service_parts
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  service_record public.vehicle_services;
  created_part public.vehicle_service_parts;
begin
  -- ===== Validación del servicio y trabajo opcional =====

  service_record := public.require_owned_vehicle_service(target_service_id);

  if target_item_id is not null and not exists (
    select 1 from public.vehicle_service_items as item
    where item.id = target_item_id
      and item.family_id = service_record.family_id
      and item.vehicle_service_id = service_record.id
      and item.archived_at is null
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'El trabajo relacionado no existe.';
  end if;

  -- ===== Persistencia de la refacción =====

  insert into public.vehicle_service_parts (
    family_id, vehicle_service_id, vehicle_service_item_id, name, brand,
    part_number, quantity, unit_cost, warranty_until, notes,
    created_by_user_id, updated_by_user_id
  ) values (
    service_record.family_id, service_record.id, target_item_id,
    trim(part_name), nullif(trim(part_brand), ''),
    nullif(trim(part_number_value), ''), part_quantity, part_unit_cost,
    part_warranty_until, nullif(trim(part_notes), ''),
    current_user_id, current_user_id
  ) returning * into created_part;

  return created_part;
end;
$$;

create function public.archive_vehicle_service_part(
  target_part_id uuid,
  expected_version bigint
)
returns public.vehicle_service_parts
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  archived_part public.vehicle_service_parts;
begin
  -- ===== Archivado con permisos y control de versión =====

  update public.vehicle_service_parts as part
  set archived_at = statement_timestamp(), updated_by_user_id = current_user_id
  from public.vehicle_services as service,
       public.vehicles as vehicle,
       public.families as family
  where part.id = target_part_id
    and part.archived_at is null
    and part.vehicle_service_id = service.id
    and part.family_id = service.family_id
    and service.vehicle_id = vehicle.id
    and service.family_id = vehicle.family_id
    and vehicle.status = 'active'
    and part.family_id = family.id
    and family.owner_user_id = current_user_id
    and part.version = expected_version
  returning part.* into archived_part;

  if archived_part.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'La refacción no existe o cambió en otra sesión.';
  end if;

  return archived_part;
end;
$$;

-- ===== Finalización segura de adjuntos =====

create function public.finalize_vehicle_service_attachment(
  attachment_id uuid,
  target_family_id uuid,
  target_service_id uuid,
  actor_user_id uuid,
  attachment_kind text,
  attachment_title text,
  file_original_filename text,
  file_storage_key text,
  file_detected_mime_type text,
  file_size_bytes bigint,
  file_sha256 text
)
returns public.vehicle_service_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_attachment public.vehicle_service_attachments;
begin
  -- ===== Validación del propietario y destino =====

  if not exists (
    select 1
    from public.vehicle_services as service
    join public.vehicles as vehicle
      on vehicle.id = service.vehicle_id and vehicle.family_id = service.family_id
    join public.families as family on family.id = service.family_id
    where service.id = target_service_id
      and service.family_id = target_family_id
      and vehicle.status = 'active'
      and family.owner_user_id = actor_user_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'No tienes permiso para agregar archivos a este servicio.';
  end if;

  -- ===== Persistencia de metadatos verificados =====

  insert into public.vehicle_service_attachments (
    id, family_id, vehicle_service_id, kind, title, original_filename,
    storage_key, detected_mime_type, size_bytes, sha256,
    created_by_user_id, updated_by_user_id
  ) values (
    attachment_id, target_family_id, target_service_id, attachment_kind,
    trim(attachment_title), file_original_filename, file_storage_key,
    file_detected_mime_type, file_size_bytes, file_sha256,
    actor_user_id, actor_user_id
  ) returning * into created_attachment;

  return created_attachment;
end;
$$;

create function public.archive_vehicle_service_attachment(
  target_attachment_id uuid,
  expected_version bigint
)
returns public.vehicle_service_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := public.require_authenticated_user();
  archived_attachment public.vehicle_service_attachments;
begin
  -- ===== Archivado con permisos y control de versión =====

  update public.vehicle_service_attachments as attachment
  set status = 'archived', archived_at = statement_timestamp(),
      updated_by_user_id = current_user_id
  from public.vehicle_services as service,
       public.vehicles as vehicle,
       public.families as family
  where attachment.id = target_attachment_id
    and attachment.status = 'active'
    and attachment.vehicle_service_id = service.id
    and attachment.family_id = service.family_id
    and service.vehicle_id = vehicle.id
    and service.family_id = vehicle.family_id
    and vehicle.status = 'active'
    and attachment.family_id = family.id
    and family.owner_user_id = current_user_id
    and attachment.version = expected_version
  returning attachment.* into archived_attachment;

  if archived_attachment.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'El archivo no existe o cambió en otra sesión.';
  end if;

  return archived_attachment;
end;
$$;

-- ===== Permisos de ejecución =====

revoke all on function public.require_owned_vehicle_service(uuid)
  from public, anon, authenticated;
revoke all on function public.create_vehicle_service_item(
  uuid, text, text, text, text, date
) from public, anon, authenticated;
revoke all on function public.set_vehicle_service_item_status(
  uuid, text, bigint
) from public, anon, authenticated;
revoke all on function public.archive_vehicle_service_item(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.create_vehicle_service_part(
  uuid, uuid, text, text, text, numeric, numeric, date, text
) from public, anon, authenticated;
revoke all on function public.archive_vehicle_service_part(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.finalize_vehicle_service_attachment(
  uuid, uuid, uuid, uuid, text, text, text, text, text, bigint, text
) from public, anon, authenticated;
revoke all on function public.archive_vehicle_service_attachment(uuid, bigint)
  from public, anon, authenticated;

grant execute on function public.create_vehicle_service_item(
  uuid, text, text, text, text, date
) to authenticated;
grant execute on function public.set_vehicle_service_item_status(
  uuid, text, bigint
) to authenticated;
grant execute on function public.archive_vehicle_service_item(uuid, bigint)
  to authenticated;
grant execute on function public.create_vehicle_service_part(
  uuid, uuid, text, text, text, numeric, numeric, date, text
) to authenticated;
grant execute on function public.archive_vehicle_service_part(uuid, bigint)
  to authenticated;
grant execute on function public.finalize_vehicle_service_attachment(
  uuid, uuid, uuid, uuid, text, text, text, text, text, bigint, text
) to service_role;
grant execute on function public.archive_vehicle_service_attachment(uuid, bigint)
  to authenticated;
