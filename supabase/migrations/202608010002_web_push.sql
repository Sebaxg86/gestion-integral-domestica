create table public.push_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint varchar(2000) not null,
  p256dh varchar(500) not null,
  auth varchar(500) not null,
  user_agent varchar(500),
  active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint push_subscriptions_endpoint_unique unique (endpoint),
  constraint push_subscriptions_endpoint_length check (char_length(endpoint) between 1 and 2000),
  constraint push_subscriptions_p256dh_length check (char_length(p256dh) between 1 and 500),
  constraint push_subscriptions_auth_length check (char_length(auth) between 1 and 500),
  constraint push_subscriptions_user_agent_length check (user_agent is null or char_length(user_agent) <= 500)
);

create table public.push_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions (id) on delete restrict,
  status varchar(20) not null default 'queued',
  attempt_count smallint not null default 0,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error varchar(500),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint push_deliveries_notification_subscription_unique unique (notification_id, subscription_id),
  constraint push_deliveries_status_allowed check (status in ('queued', 'sent', 'failed')),
  constraint push_deliveries_attempt_count_valid check (attempt_count between 0 and 5),
  constraint push_deliveries_state_consistent check (
    (status = 'queued' and sent_at is null and failed_at is null)
    or (status = 'sent' and sent_at is not null and failed_at is null)
    or (status = 'failed' and sent_at is null and failed_at is not null)
  )
);

create index push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id)
  where active;

create index push_deliveries_queued_idx
  on public.push_deliveries (created_at)
  where status = 'queued';

create or replace function public.set_push_subscription_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions
for each row execute function public.set_push_subscription_updated_at();

create or replace function public.enqueue_push_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.push_deliveries (notification_id, subscription_id)
  select new.id, subscription.id
  from public.push_subscriptions as subscription
  where subscription.user_id = new.recipient_user_id
    and subscription.active
  on conflict (notification_id, subscription_id) do nothing;

  return new;
end;
$$;

create trigger notifications_enqueue_push_deliveries after insert on public.notifications
for each row execute function public.enqueue_push_deliveries();

alter table public.push_subscriptions enable row level security;
alter table public.push_deliveries enable row level security;

revoke all on public.push_subscriptions, public.push_deliveries from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create policy push_subscriptions_select_own on public.push_subscriptions
for select to authenticated
using (user_id = (select auth.uid()));

create policy push_subscriptions_insert_own on public.push_subscriptions
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy push_subscriptions_update_own on public.push_subscriptions
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy push_subscriptions_delete_own on public.push_subscriptions
for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on function public.enqueue_push_deliveries() from public;
revoke all on function public.set_push_subscription_updated_at() from public;
