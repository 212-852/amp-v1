-- One owner participant per user or guest visitor.

drop index if exists public.participants_owner_guest_uidx;
drop index if exists public.participants_owner_user_uidx;

create unique index if not exists participants_one_room_per_user_idx
  on public.participants (user_uuid)
  where user_uuid is not null
    and role in ('user', 'guest');

create unique index if not exists participants_one_room_per_visitor_idx
  on public.participants (visitor_uuid)
  where visitor_uuid is not null
    and user_uuid is null
    and role = 'guest';
