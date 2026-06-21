create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_uuid uuid null references public.users(user_uuid) on delete cascade,
  visitor_uuid uuid null references public.visitors(visitor_uuid) on delete cascade,
  endpoint text not null,
  p256dh text null,
  auth text null,
  user_agent text null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_uuid is not null or visitor_uuid is not null)
);

create unique index if not exists push_subscriptions_endpoint_uidx
on public.push_subscriptions (endpoint);

create index if not exists push_subscriptions_user_uuid_idx
on public.push_subscriptions (user_uuid)
where enabled = true;

create index if not exists push_subscriptions_visitor_uuid_idx
on public.push_subscriptions (visitor_uuid)
where enabled = true;

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row
execute function set_updated_at();

notify pgrst, 'reload schema';

