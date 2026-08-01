revoke all on function public.handle_auth_user_change() from public, anon, authenticated;

create index document_files_created_by_owner_idx
  on public.document_files (family_id, created_by_user_id);

create index documents_created_by_owner_idx
  on public.documents (family_id, created_by_user_id);

create index documents_updated_by_owner_idx
  on public.documents (family_id, updated_by_user_id);

create index notifications_reminder_family_idx
  on public.notifications (family_id, reminder_id);

create index properties_created_by_owner_idx
  on public.properties (family_id, created_by_user_id);

create index properties_updated_by_owner_idx
  on public.properties (family_id, updated_by_user_id);

create index reminders_created_by_owner_idx
  on public.reminders (family_id, created_by_user_id);

create index reminders_updated_by_owner_idx
  on public.reminders (family_id, updated_by_user_id);
