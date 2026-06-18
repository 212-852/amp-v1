-- Welcome only: one flex welcome row per room.
-- Do not unique-index room_uuid alone (that blocks normal user messages).

drop index if exists public.messages_one_per_room;
drop index if exists public.messages_one_welcome_per_room;
drop index if exists public.messages_room_welcome_unique;

create unique index if not exists messages_one_welcome_per_room
  on public.messages (room_uuid)
  where type = 'flex'
    and body = 'welcome';

notify pgrst, 'reload schema';
