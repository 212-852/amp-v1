create table if not exists public.contacts (
  contact_uuid uuid primary key default gen_random_uuid(),

  user_uuid uuid null references public.users(user_uuid),
  visitor_uuid uuid null references public.visitors(visitor_uuid),

  type text not null check (type in ('line', 'email', 'push', 'discord')),
  value text not null,
  channel text not null check (channel in ('web', 'pwa', 'liff', 'line')),
  state text not null check (state in ('active', 'background', 'hidden', 'offline')),
  receive boolean not null default true,
  last_seen_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (user_uuid is not null or visitor_uuid is not null)
);

create unique index if not exists contacts_user_type_value_uidx
  on public.contacts (user_uuid, type, value);

create unique index if not exists contacts_visitor_type_value_uidx
  on public.contacts (visitor_uuid, type, value);

create index if not exists contacts_user_uuid_idx
  on public.contacts (user_uuid);

create index if not exists contacts_visitor_uuid_idx
  on public.contacts (visitor_uuid);

create trigger contacts_set_updated_at
before update on public.contacts
for each row
execute function set_updated_at();
