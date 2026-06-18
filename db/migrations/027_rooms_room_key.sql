alter table public.rooms
add column if not exists room_key text;

update public.rooms
set room_key = 'order:' || order_uuid::text
where room_key is null
  and order_uuid is not null;

update public.rooms
set room_key = 'user:' || user_uuid::text
where room_key is null
  and user_uuid is not null
  and order_uuid is null;

update public.rooms
set room_key = 'visitor:' || visitor_uuid::text
where room_key is null
  and user_uuid is null
  and visitor_uuid is not null
  and order_uuid is null;

update public.rooms r
set room_key = 'user:' || p.user_uuid::text,
    user_uuid = coalesce(r.user_uuid, p.user_uuid)
from public.participants p
where r.room_key is null
  and r.order_uuid is null
  and p.room_uuid = r.room_uuid
  and p.user_uuid is not null
  and p.role in ('user', 'guest');

update public.rooms r
set room_key = 'visitor:' || p.visitor_uuid::text,
    visitor_uuid = coalesce(r.visitor_uuid, p.visitor_uuid)
from public.participants p
where r.room_key is null
  and r.user_uuid is null
  and r.order_uuid is null
  and p.room_uuid = r.room_uuid
  and p.visitor_uuid is not null
  and p.user_uuid is null
  and p.role = 'guest';

with ranked as (
  select
    room_uuid,
    room_key,
    first_value(room_uuid) over (
      partition by room_key
      order by created_at asc, room_uuid asc
    ) as keep_room_uuid,
    row_number() over (
      partition by room_key
      order by created_at asc, room_uuid asc
    ) as rn
  from public.rooms
  where room_key is not null
),
duplicate_rooms as (
  select room_uuid, keep_room_uuid
  from ranked
  where rn > 1
)
update public.messages m
set room_uuid = d.keep_room_uuid,
    participant_uuid = null
from duplicate_rooms d
where m.room_uuid = d.room_uuid;

with ranked as (
  select
    room_uuid,
    room_key,
    row_number() over (
      partition by room_key
      order by created_at asc, room_uuid asc
    ) as rn
  from public.rooms
  where room_key is not null
)
delete from public.rooms r
using ranked d
where r.room_uuid = d.room_uuid
  and d.rn > 1;

drop index if exists public.rooms_personal_user_unique;
drop index if exists public.rooms_guest_visitor_unique;
drop index if exists public.rooms_order_unique;
drop index if exists public.rooms_room_key_unique;

create unique index rooms_room_key_unique
  on public.rooms (room_key);

drop index if exists public.participants_owner_user_uidx;
drop index if exists public.participants_owner_guest_uidx;
drop index if exists public.participants_one_room_per_user_idx;
drop index if exists public.participants_one_room_per_visitor_idx;
drop index if exists public.participants_room_user_uidx;
drop index if exists public.participants_room_visitor_uidx;

with ranked as (
  select
    participant_uuid,
    row_number() over (
      partition by room_uuid, role, user_uuid
      order by joined_at asc, participant_uuid asc
    ) as rn
  from public.participants
  where user_uuid is not null
)
update public.messages m
set participant_uuid = null
from ranked d
where m.participant_uuid = d.participant_uuid
  and d.rn > 1;

with ranked as (
  select
    participant_uuid,
    row_number() over (
      partition by room_uuid, role, user_uuid
      order by joined_at asc, participant_uuid asc
    ) as rn
  from public.participants
  where user_uuid is not null
)
delete from public.participants p
using ranked d
where p.participant_uuid = d.participant_uuid
  and d.rn > 1;

with ranked as (
  select
    participant_uuid,
    row_number() over (
      partition by room_uuid, role, visitor_uuid
      order by joined_at asc, participant_uuid asc
    ) as rn
  from public.participants
  where visitor_uuid is not null
)
update public.messages m
set participant_uuid = null
from ranked d
where m.participant_uuid = d.participant_uuid
  and d.rn > 1;

with ranked as (
  select
    participant_uuid,
    row_number() over (
      partition by room_uuid, role, visitor_uuid
      order by joined_at asc, participant_uuid asc
    ) as rn
  from public.participants
  where visitor_uuid is not null
)
delete from public.participants p
using ranked d
where p.participant_uuid = d.participant_uuid
  and d.rn > 1;

with ranked as (
  select
    participant_uuid,
    row_number() over (
      partition by room_uuid, role
      order by joined_at asc, participant_uuid asc
    ) as rn
  from public.participants
  where role = 'bot'
)
update public.messages m
set participant_uuid = null
from ranked d
where m.participant_uuid = d.participant_uuid
  and d.rn > 1;

with ranked as (
  select
    participant_uuid,
    row_number() over (
      partition by room_uuid, role
      order by joined_at asc, participant_uuid asc
    ) as rn
  from public.participants
  where role = 'bot'
)
delete from public.participants p
using ranked d
where p.participant_uuid = d.participant_uuid
  and d.rn > 1;

create unique index if not exists participants_room_role_user_unique
  on public.participants (room_uuid, role, user_uuid)
  where user_uuid is not null;

create unique index if not exists participants_room_role_visitor_unique
  on public.participants (room_uuid, role, visitor_uuid)
  where visitor_uuid is not null;

create unique index if not exists participants_room_bot_unique
  on public.participants (room_uuid, role)
  where role = 'bot';

notify pgrst, 'reload schema';
