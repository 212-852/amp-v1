create extension if not exists pgcrypto;

create table visitors (
  visitor_uuid uuid primary key default gen_random_uuid(),

  user_uuid uuid null references users(user_uuid),
  source_channel text not null default 'web',
  state text not null default 'offline'
    check (state in ('active', 'background', 'hidden', 'offline')),
  receive boolean not null default true,
  last_seen_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visitors_user_uuid_idx
  on visitors (user_uuid);

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
