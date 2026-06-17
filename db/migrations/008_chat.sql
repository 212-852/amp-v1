create table if not exists public.rooms (
  room_uuid uuid primary key default gen_random_uuid(),
  mode text not null default 'bot'
    check (mode in ('bot', 'concierge', 'group')),
  locale text not null default 'ja',
  channel text not null default 'web'
    check (channel in ('web', 'pwa', 'liff', 'line')),
  owner_visitor_uuid uuid null references public.visitors(visitor_uuid),
  owner_user_uuid uuid null references public.users(user_uuid),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_visitor_uuid is not null or owner_user_uuid is not null)
);

create index if not exists rooms_owner_visitor_uuid_idx
  on public.rooms (owner_visitor_uuid);

create index if not exists rooms_owner_user_uuid_idx
  on public.rooms (owner_user_uuid);

create unique index if not exists rooms_owner_user_uuid_uidx
  on public.rooms (owner_user_uuid)
  where owner_user_uuid is not null;

create unique index if not exists rooms_owner_visitor_uuid_uidx
  on public.rooms (owner_visitor_uuid)
  where owner_user_uuid is null
    and owner_visitor_uuid is not null;

create index if not exists rooms_channel_idx
  on public.rooms (channel);

create table if not exists public.room_participants (
  participant_uuid uuid primary key default gen_random_uuid(),
  room_uuid uuid not null references public.rooms(room_uuid) on delete cascade,
  role text not null
    check (role in ('guest', 'user', 'admin', 'driver', 'concierge', 'bot')),
  visitor_uuid uuid null references public.visitors(visitor_uuid),
  user_uuid uuid null references public.users(user_uuid),
  display_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visitor_uuid is not null or user_uuid is not null or role in ('bot', 'concierge'))
);

create index if not exists room_participants_room_uuid_idx
  on public.room_participants (room_uuid);

create index if not exists room_participants_visitor_uuid_idx
  on public.room_participants (visitor_uuid);

create index if not exists room_participants_user_uuid_idx
  on public.room_participants (user_uuid);

create unique index if not exists room_participants_room_visitor_uidx
  on public.room_participants (room_uuid, visitor_uuid)
  where visitor_uuid is not null;

create unique index if not exists room_participants_room_user_uidx
  on public.room_participants (room_uuid, user_uuid)
  where user_uuid is not null;

create table if not exists public.messages (
  message_uuid uuid primary key default gen_random_uuid(),
  room_uuid uuid not null references public.rooms(room_uuid) on delete cascade,
  participant_uuid uuid null references public.room_participants(participant_uuid),
  source_channel text not null default 'web'
    check (source_channel in ('web', 'pwa', 'liff', 'line')),
  kind text not null default 'user'
    check (kind in ('user', 'system', 'bot', 'concierge')),
  type text not null default 'text'
    check (type in ('text', 'image', 'file', 'location', 'flex', 'system', 'typing')),
  body_original text not null,
  original_locale text not null,
  body_display text not null,
  display_locale text not null,
  translations jsonb not null default '{}'::jsonb,
  translation_status text not null default 'none'
    check (translation_status in ('none', 'pending', 'complete', 'failed')),
  payload jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists messages_room_uuid_created_at_idx
  on public.messages (room_uuid, created_at desc);

create table if not exists public.room_typing_states (
  room_uuid uuid not null references public.rooms(room_uuid) on delete cascade,
  participant_uuid uuid not null references public.room_participants(participant_uuid) on delete cascade,
  display_name text not null,
  locale text not null default 'ja',
  updated_at timestamptz not null default now(),
  primary key (room_uuid, participant_uuid)
);

create index if not exists room_typing_states_room_uuid_idx
  on public.room_typing_states (room_uuid);

create table if not exists public.concierge_availability (
  id int primary key default 1 check (id = 1),
  available boolean not null default true,
  updated_by uuid null references public.users(user_uuid),
  updated_at timestamptz not null default now()
);

insert into public.concierge_availability (id, available)
values (1, true)
on conflict (id) do nothing;

create trigger rooms_set_updated_at
before update on public.rooms
for each row
execute function set_updated_at();

create trigger room_participants_set_updated_at
before update on public.room_participants
for each row
execute function set_updated_at();
