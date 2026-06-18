alter table public.messages
add column if not exists message_kind text;

update public.messages
set message_kind = 'welcome'
where message_kind is null
  and body = 'welcome'
  and type = 'flex';

create index if not exists messages_room_kind_idx
  on public.messages (room_uuid, message_kind);

create unique index if not exists messages_room_welcome_unique
  on public.messages (room_uuid, message_kind)
  where message_kind = 'welcome';

notify pgrst, 'reload schema';
