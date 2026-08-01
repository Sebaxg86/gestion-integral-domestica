create or replace function public.replace_document_file(
  actor_user_id uuid,
  target_document_id uuid,
  new_file_id uuid,
  new_storage_key text,
  new_original_filename text,
  new_detected_mime_type text,
  new_size_bytes bigint,
  new_sha256 text,
  expected_version bigint
)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  document_record public.documents;
  expected_storage_key text;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'La operación requiere el proceso seguro de archivos.';
  end if;

  select document.* into document_record
  from public.documents as document
  join public.properties as property
    on property.family_id = document.family_id and property.id = document.property_id
  join public.families as family on family.id = document.family_id
  where document.id = target_document_id
    and family.owner_user_id = actor_user_id
    and document.status = 'active'
    and property.status = 'active'
  for update of document;

  if document_record.id is null then
    raise exception using errcode = 'P0002', message = 'El documento no existe o está archivado.';
  end if;

  expected_storage_key := format(
    'families/%s/documents/%s/files/%s',
    document_record.family_id,
    document_record.id,
    new_file_id
  );
  if new_storage_key <> expected_storage_key then
    raise exception using errcode = '22023', message = 'La ubicación del archivo no es válida.';
  end if;

  if exists (
    select 1 from public.document_files
    where id = new_file_id
      and document_id = document_record.id
      and storage_key = new_storage_key
      and sha256 = new_sha256
      and status = 'active'
  ) then
    return document_record;
  end if;

  if document_record.version <> expected_version then
    raise exception using errcode = '40001', message = 'El documento cambió en otra sesión.';
  end if;

  update public.document_files
  set status = 'replaced',
      replaced_at = statement_timestamp()
  where family_id = document_record.family_id
    and document_id = document_record.id
    and status = 'active';

  insert into public.document_files (
    id, family_id, document_id, storage_key, original_filename,
    detected_mime_type, size_bytes, sha256, created_by_user_id
  ) values (
    new_file_id, document_record.family_id, document_record.id, new_storage_key,
    trim(new_original_filename), new_detected_mime_type, new_size_bytes,
    lower(new_sha256), actor_user_id
  );

  update public.documents
  set updated_by_user_id = actor_user_id
  where id = document_record.id
  returning * into document_record;

  return document_record;
end;
$$;

revoke all on function public.replace_document_file(
  uuid, uuid, uuid, text, text, text, bigint, text, bigint
) from public, anon, authenticated;
grant execute on function public.replace_document_file(
  uuid, uuid, uuid, text, text, text, bigint, text, bigint
) to service_role;
