create table if not exists public.contacts (
  contact_uuid uuid primary key default gen_random_uuid(),

  user_uuid uuid null references public.users(user_uuid),
  visitor_uuid uuid null references public.visitors(visitor_uuid),

  type text not null check (type in ('line', 'email', 'push', 'discord')),
  value text not null,
  channel text not null default 'web'
    check (channel in ('web', 'pwa', 'liff', 'line')),
  state text not null default 'offline'
    check (state in ('active', 'background', 'hidden', 'offline')),
  receive boolean not null default true,
  last_seen_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (user_uuid is not null or visitor_uuid is not null)
);

drop index if exists contacts_user_type_value_uidx;

drop index if exists contacts_visitor_type_value_uidx;

drop index if exists contacts_visitor_type_uidx;

drop index if exists contacts_user_type_uidx;

alter table public.visitors
drop column if exists state,
drop column if exists receive,
drop column if exists last_seen_at;

delete from public.contacts
where value like 'push:visitor:%';

alter table public.contacts
add column if not exists channel text not null default 'web'
  check (channel in ('web', 'pwa', 'liff', 'line')),
add column if not exists state text not null default 'offline'
  check (state in ('active', 'background', 'hidden', 'offline')),
add column if not exists receive boolean not null default true,
add column if not exists last_seen_at timestamptz null;

delete from public.contacts a
using public.contacts b
where a.contact_uuid <> b.contact_uuid
  and a.visitor_uuid is not null
  and a.visitor_uuid = b.visitor_uuid
  and a.type = b.type
  and a.value = b.value
  and (
    a.updated_at < b.updated_at
    or (a.updated_at = b.updated_at and a.contact_uuid < b.contact_uuid)
  );

delete from public.contacts a
using public.contacts b
where a.contact_uuid <> b.contact_uuid
  and a.user_uuid is not null
  and a.user_uuid = b.user_uuid
  and a.type = b.type
  and a.value = b.value
  and (
    a.updated_at < b.updated_at
    or (a.updated_at = b.updated_at and a.contact_uuid < b.contact_uuid)
  );

create unique index if not exists contacts_visitor_type_value_uidx
  on public.contacts (visitor_uuid, type, value);

create unique index if not exists contacts_user_type_value_uidx
  on public.contacts (user_uuid, type, value);

create index if not exists contacts_user_uuid_idx
  on public.contacts (user_uuid);

create index if not exists contacts_visitor_uuid_idx
  on public.contacts (visitor_uuid);

create trigger contacts_set_updated_at
before update on public.contacts
for each row
execute function set_updated_at();
