alter table public.rooms
add column if not exists channel text not null default 'web'
  check (channel in ('web', 'pwa', 'liff', 'line'));

create unique index if not exists rooms_owner_user_uuid_uidx
  on public.rooms (owner_user_uuid)
  where owner_user_uuid is not null;

create unique index if not exists rooms_owner_visitor_uuid_uidx
  on public.rooms (owner_visitor_uuid)
  where owner_user_uuid is null
    and owner_visitor_uuid is not null;

create index if not exists rooms_channel_idx
  on public.rooms (channel);
