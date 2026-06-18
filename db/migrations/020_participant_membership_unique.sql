-- Ensure participant membership uniqueness per room and owner uniqueness per identity.

create unique index if not exists participants_room_user_uidx
  on public.participants (room_uuid, user_uuid)
  where user_uuid is not null;

create unique index if not exists participants_room_visitor_uidx
  on public.participants (room_uuid, visitor_uuid)
  where visitor_uuid is not null;

create unique index if not exists participants_one_room_per_user_idx
  on public.participants (user_uuid)
  where user_uuid is not null
    and role in ('user', 'guest');

create unique index if not exists participants_one_room_per_visitor_idx
  on public.participants (visitor_uuid)
  where visitor_uuid is not null
    and user_uuid is null
    and role = 'guest';
