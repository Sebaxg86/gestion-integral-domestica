insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'documents',
  'documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'application/octet-stream']
) on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy document_objects_select_owned
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and (
    (
      (storage.foldername(name))[1] = 'staging'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (storage.foldername(name))[1] = 'families'
      and exists (
        select 1
        from public.families
        where families.id::text = (storage.foldername(name))[2]
          and families.owner_user_id = (select auth.uid())
      )
    )
  )
);

create policy document_objects_insert_staging
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = 'staging'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
);

create policy document_objects_delete_own_staging
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = 'staging'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
);
