create table if not exists public.presence (
  presence_uuid uuid primary key default gen_random_uuid(),
  room_uuid uuid not null references public.rooms(room_uuid) on delete cascade,
  participant_uuid uuid not null references public.participants(participant_uuid) on delete cascade,
  user_uuid uuid null references public.users(user_uuid),
  display_name text not null,
  role text not null,
  is_online boolean not null default true,
  status text not null default 'entered'
    check (status in ('entered', 'left')),
  entered_at timestamptz not null default now(),
  left_at timestamptz null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_uuid, participant_uuid)
);

create index if not exists presence_room_uuid_idx
  on public.presence (room_uuid);

create index if not exists presence_room_online_idx
  on public.presence (room_uuid, is_online)
  where is_online = true;

create index if not exists presence_user_uuid_idx
  on public.presence (user_uuid);

drop table if exists public.room_typing_states;

create trigger presence_set_updated_at
before update on public.presence
for each row
execute function set_updated_at();
