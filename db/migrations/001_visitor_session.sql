create extension if not exists pgcrypto;

create table visitors (
  visitor_uuid uuid primary key default gen_random_uuid(),

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  first_source_channel text,
  last_source_channel text,

  first_path text,
  last_path text,

  locale text default 'ja',

  user_agent text,
  ip_hash text,

  linked_user_uuid uuid null references users(user_uuid),

  status text not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visitors_linked_user_uuid_idx
  on visitors (linked_user_uuid);

create index visitors_last_seen_at_idx
  on visitors (last_seen_at);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger visitors_set_updated_at
before update on visitors
for each row
execute function set_updated_at();
