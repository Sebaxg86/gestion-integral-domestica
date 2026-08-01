create or replace function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
  profile_provider text;
begin
  profile_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  profile_provider := trim(coalesce(new.raw_app_meta_data ->> 'provider', 'supabase'));

  if char_length(profile_name) < 2 then
    profile_name := 'Usuario GID';
  end if;

  if char_length(profile_provider) < 1 then
    profile_provider := 'supabase';
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
    left(profile_provider, 50),
    new.id::text,
    lower(trim(new.email)),
    left(profile_name, 100),
    new.email_confirmed_at
  )
  on conflict (id) do update
  set auth_provider = excluded.auth_provider,
      email = excluded.email,
      email_verified_at = excluded.email_verified_at;

  return new;
end;
$$;

revoke all on function public.handle_auth_user_change() from public, anon, authenticated;
