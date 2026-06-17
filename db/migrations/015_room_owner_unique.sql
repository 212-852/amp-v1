-- Enforce one owner participant per visitor/user at the database layer.
-- Room ownership is resolved through participants, not rooms.owner_* columns.

drop index if exists public.participants_owner_guest_uidx;

create unique index participants_owner_guest_uidx
  on public.participants (visitor_uuid)
  where visitor_uuid is not null
    and role = 'guest'
    and user_uuid is null;

drop index if exists public.participants_owner_user_uidx;

create unique index participants_owner_user_uidx
  on public.participants (user_uuid)
  where user_uuid is not null
    and role = 'user';

create index if not exists participants_owner_user_lookup_idx
  on public.participants (user_uuid, joined_at)
  where user_uuid is not null
    and role in ('guest', 'user');

create index if not exists participants_owner_guest_lookup_idx
  on public.participants (visitor_uuid, joined_at)
  where visitor_uuid is not null
    and role = 'guest'
    and user_uuid is null;
