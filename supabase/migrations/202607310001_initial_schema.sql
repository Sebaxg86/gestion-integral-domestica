create extension if not exists pgcrypto with schema extensions;

create table public.users (
  id uuid primary key references auth.users (id) on delete restrict,
  auth_provider varchar(50) not null default 'supabase',
  auth_subject varchar(255) not null,
  email varchar(320) not null,
  full_name varchar(100) not null,
  email_verified_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1,
  constraint users_auth_identity_unique unique (auth_provider, auth_subject),
  constraint users_full_name_length check (char_length(trim(full_name)) between 2 and 100),
  constraint users_email_normalized check (email = lower(trim(email))),
  constraint users_version_positive check (version >= 1)
);

create unique index users_email_lower_unique on public.users (lower(email));

create table public.families (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete restrict,
  name varchar(80) not null,
  timezone varchar(64) not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1,
  constraint families_owner_unique unique (owner_user_id),
  constraint families_id_owner_unique unique (id, owner_user_id),
  constraint families_name_length check (char_length(trim(name)) between 2 and 80),
  constraint families_timezone_length check (char_length(timezone) between 1 and 64),
  constraint families_version_positive check (version >= 1)
);

create table public.properties (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  name varchar(100) not null,
  type varchar(30) not null,
  address varchar(300),
  status varchar(20) not null default 'active',
  archived_at timestamptz,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1,
  constraint properties_family_id_unique unique (family_id, id),
  constraint properties_name_length check (char_length(trim(name)) between 2 and 100),
  constraint properties_type_allowed check (type in ('house', 'apartment', 'land', 'commercial', 'other')),
  constraint properties_address_length check (address is null or char_length(address) <= 300),
  constraint properties_status_allowed check (status in ('active', 'archived')),
  constraint properties_archive_consistent check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  ),
  constraint properties_version_positive check (version >= 1),
  constraint properties_created_by_owner_fk foreign key (family_id, created_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint properties_updated_by_owner_fk foreign key (family_id, updated_by_user_id)
    references public.families (id, owner_user_id) on delete restrict
);

create table public.documents (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  property_id uuid not null,
  name varchar(150) not null,
  category varchar(30) not null,
  issue_date date,
  expiration_date date,
  issuer varchar(150),
  document_number varchar(100),
  notes varchar(2000),
  status varchar(20) not null default 'active',
  archived_at timestamptz,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1,
  constraint documents_family_id_unique unique (family_id, id),
  constraint documents_property_fk foreign key (family_id, property_id)
    references public.properties (family_id, id) on delete restrict,
  constraint documents_created_by_owner_fk foreign key (family_id, created_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint documents_updated_by_owner_fk foreign key (family_id, updated_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint documents_name_length check (char_length(trim(name)) between 2 and 150),
  constraint documents_category_allowed check (category in (
    'deed', 'contract', 'insurance_policy', 'property_tax_receipt', 'appraisal',
    'plan', 'warranty', 'invoice', 'permit', 'other'
  )),
  constraint documents_dates_ordered check (
    issue_date is null or expiration_date is null or expiration_date >= issue_date
  ),
  constraint documents_issuer_length check (issuer is null or char_length(issuer) <= 150),
  constraint documents_number_length check (document_number is null or char_length(document_number) <= 100),
  constraint documents_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint documents_status_allowed check (status in ('active', 'archived')),
  constraint documents_archive_consistent check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  ),
  constraint documents_version_positive check (version >= 1)
);

create table public.document_files (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  document_id uuid not null,
  storage_key varchar(500) not null,
  original_filename varchar(255) not null,
  detected_mime_type varchar(100) not null,
  size_bytes bigint not null,
  sha256 char(64) not null,
  status varchar(20) not null default 'active',
  created_by_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  activated_at timestamptz not null default statement_timestamp(),
  replaced_at timestamptz,
  deleted_at timestamptz,
  constraint document_files_storage_key_unique unique (storage_key),
  constraint document_files_document_fk foreign key (family_id, document_id)
    references public.documents (family_id, id) on delete restrict,
  constraint document_files_created_by_owner_fk foreign key (family_id, created_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint document_files_filename_length check (char_length(trim(original_filename)) between 1 and 255),
  constraint document_files_mime_allowed check (detected_mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  constraint document_files_size_allowed check (size_bytes between 1 and 10485760),
  constraint document_files_sha256_format check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint document_files_status_allowed check (status in ('active', 'replaced', 'deleted')),
  constraint document_files_transition_consistent check (
    (status = 'active' and replaced_at is null and deleted_at is null)
    or (status = 'replaced' and replaced_at is not null and deleted_at is null)
    or (status = 'deleted' and deleted_at is not null)
  )
);

create table public.reminders (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  document_id uuid not null,
  lead_days smallint not null,
  scheduled_for timestamptz not null,
  status varchar(20) not null default 'scheduled',
  notified_at timestamptz,
  attended_at timestamptz,
  cancelled_at timestamptz,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1,
  constraint reminders_family_id_unique unique (family_id, id),
  constraint reminders_document_fk foreign key (family_id, document_id)
    references public.documents (family_id, id) on delete restrict,
  constraint reminders_created_by_owner_fk foreign key (family_id, created_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint reminders_updated_by_owner_fk foreign key (family_id, updated_by_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint reminders_lead_days_allowed check (lead_days in (0, 1, 3, 7, 15, 30)),
  constraint reminders_status_allowed check (status in ('scheduled', 'notified', 'attended', 'cancelled')),
  constraint reminders_transition_consistent check (
    (status = 'scheduled' and notified_at is null and attended_at is null and cancelled_at is null)
    or (status = 'notified' and notified_at is not null and attended_at is null and cancelled_at is null)
    or (status = 'attended' and notified_at is not null and attended_at is not null and cancelled_at is null)
    or (status = 'cancelled' and attended_at is null and cancelled_at is not null)
  ),
  constraint reminders_version_positive check (version >= 1)
);

create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  reminder_id uuid not null,
  recipient_user_id uuid not null,
  title varchar(200) not null,
  message varchar(500) not null,
  status varchar(20) not null default 'unread',
  read_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint notifications_reminder_recipient_unique unique (reminder_id, recipient_user_id),
  constraint notifications_reminder_fk foreign key (family_id, reminder_id)
    references public.reminders (family_id, id) on delete restrict,
  constraint notifications_recipient_owner_fk foreign key (family_id, recipient_user_id)
    references public.families (id, owner_user_id) on delete restrict,
  constraint notifications_title_length check (char_length(trim(title)) between 1 and 200),
  constraint notifications_message_length check (char_length(trim(message)) between 1 and 500),
  constraint notifications_status_allowed check (status in ('unread', 'read')),
  constraint notifications_read_consistent check (
    (status = 'unread' and read_at is null)
    or (status = 'read' and read_at is not null)
  )
);

create index properties_family_status_updated_idx
  on public.properties (family_id, status, updated_at desc);
create index documents_family_property_status_name_idx
  on public.documents (family_id, property_id, status, name, id);
create index documents_active_expiration_idx
  on public.documents (family_id, expiration_date)
  where status = 'active' and expiration_date is not null;
create unique index document_files_one_active_idx
  on public.document_files (family_id, document_id)
  where status = 'active';
create index reminders_due_idx
  on public.reminders (scheduled_for)
  where status = 'scheduled';
create unique index reminders_one_open_idx
  on public.reminders (family_id, document_id)
  where status in ('scheduled', 'notified');
create index notifications_inbox_idx
  on public.notifications (family_id, recipient_user_id, status, created_at desc, id desc);

create or replace function public.set_updated_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger users_set_updated_fields before update on public.users
for each row execute function public.set_updated_fields();
create trigger families_set_updated_fields before update on public.families
for each row execute function public.set_updated_fields();
create trigger properties_set_updated_fields before update on public.properties
for each row execute function public.set_updated_fields();
create trigger documents_set_updated_fields before update on public.documents
for each row execute function public.set_updated_fields();
create trigger reminders_set_updated_fields before update on public.reminders
for each row execute function public.set_updated_fields();

create or replace function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
begin
  profile_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));

  if char_length(profile_name) < 2 then
    profile_name := 'Usuario GID';
  end if;

  insert into public.users (
    id,
    auth_provider,
    auth_subject,
    email,
    full_name,
    email_verified_at
  ) values (
    new.id,
    'supabase',
    new.id::text,
    lower(trim(new.email)),
    left(profile_name, 100),
    new.email_confirmed_at
  )
  on conflict (id) do update
  set email = excluded.email,
      email_verified_at = excluded.email_verified_at;

  return new;
end;
$$;

create trigger on_auth_user_changed
after insert or update of email, email_confirmed_at, raw_user_meta_data on auth.users
for each row execute function public.handle_auth_user_change();

alter table public.users enable row level security;
alter table public.families enable row level security;
alter table public.properties enable row level security;
alter table public.documents enable row level security;
alter table public.document_files enable row level security;
alter table public.reminders enable row level security;
alter table public.notifications enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.users, public.families, public.properties, public.documents,
  public.document_files, public.reminders, public.notifications to authenticated;

create policy users_select_own on public.users
for select to authenticated
using (id = (select auth.uid()));

create policy families_select_owned on public.families
for select to authenticated
using (owner_user_id = (select auth.uid()));

create policy properties_select_owned on public.properties
for select to authenticated
using (exists (
  select 1 from public.families
  where families.id = properties.family_id
    and families.owner_user_id = (select auth.uid())
));

create policy documents_select_owned on public.documents
for select to authenticated
using (exists (
  select 1 from public.families
  where families.id = documents.family_id
    and families.owner_user_id = (select auth.uid())
));

create policy document_files_select_owned on public.document_files
for select to authenticated
using (exists (
  select 1 from public.families
  where families.id = document_files.family_id
    and families.owner_user_id = (select auth.uid())
));

create policy reminders_select_owned on public.reminders
for select to authenticated
using (exists (
  select 1 from public.families
  where families.id = reminders.family_id
    and families.owner_user_id = (select auth.uid())
));

create policy notifications_select_owned on public.notifications
for select to authenticated
using (recipient_user_id = (select auth.uid()));

revoke all on function public.set_updated_fields() from public;
revoke all on function public.handle_auth_user_change() from public;
