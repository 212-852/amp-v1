-- Align chat tables with current schema (rooms, participants, messages, bot_messages, presence).

-- rooms: drop owner identity columns (identity lives on participants)
drop index if exists public.rooms_owner_user_uuid_uidx;
drop index if exists public.rooms_owner_visitor_uuid_uidx;
drop index if exists public.rooms_owner_visitor_uuid_idx;
drop index if exists public.rooms_owner_user_uuid_idx;

alter table public.rooms
drop constraint if exists rooms_owner_visitor_uuid_fkey;

alter table public.rooms
drop constraint if exists rooms_owner_user_uuid_fkey;

alter table public.rooms
drop constraint if exists rooms_check;

alter table public.rooms
drop column if exists owner_visitor_uuid;

alter table public.rooms
drop column if exists owner_user_uuid;

-- participants: joined_at only, no display_name
alter table public.participants
add column if not exists joined_at timestamptz;

update public.participants
set joined_at = coalesce(created_at, now())
where joined_at is null;

alter table public.participants
alter column joined_at set default now();

alter table public.participants
alter column joined_at set not null;

alter table public.participants
drop column if exists display_name;

alter table public.participants
drop column if exists created_at;

alter table public.participants
drop column if exists updated_at;

drop trigger if exists participants_set_updated_at on public.participants;

create unique index if not exists participants_owner_user_uidx
  on public.participants (user_uuid)
  where user_uuid is not null
    and role = 'user';

create unique index if not exists participants_owner_guest_uidx
  on public.participants (visitor_uuid)
  where visitor_uuid is not null
    and role = 'guest'
    and user_uuid is null;

-- messages: body + status + payload (translation in payload)
alter table public.messages
add column if not exists status text not null default 'sent'
  check (status in ('sent', 'failed'));

alter table public.messages
add column if not exists body text;

update public.messages
set body = coalesce(nullif(body, ''), body_display, body_original, '')
where body is null
   or body = '';

update public.messages
set payload = coalesce(payload, '{}'::jsonb)
  || jsonb_build_object(
    'meta',
    coalesce(payload->'meta', '{}'::jsonb)
      || jsonb_strip_nulls(
        jsonb_build_object(
          'original_locale', original_locale,
          'display_locale', display_locale,
          'translations', translations,
          'translation_status', translation_status,
          'source_kind', kind
        )
      )
  )
where exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'messages'
    and column_name = 'body_display'
);

alter table public.messages
drop column if exists source_channel;

alter table public.messages
drop column if exists kind;

alter table public.messages
drop column if exists body_original;

alter table public.messages
drop column if exists original_locale;

alter table public.messages
drop column if exists body_display;

alter table public.messages
drop column if exists display_locale;

alter table public.messages
drop column if exists translations;

alter table public.messages
drop column if exists translation_status;

alter table public.messages
alter column body set not null;

-- bot_messages: key + type
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bot_messages'
      and column_name = 'message_key'
  ) then
    alter table public.bot_messages
    rename column message_key to key;
  end if;
end $$;

alter table public.bot_messages
add column if not exists type text not null default 'text'
  check (type in ('text', 'image', 'file', 'location', 'flex', 'system'));

update public.bot_messages
set type = 'flex'
where type = 'text'
  and (
    payload->'line'->>'type' = 'flex'
    or payload->'web'->>'variant' = 'cards'
  );

alter table public.bot_messages
drop column if exists updated_at;

drop trigger if exists bot_messages_set_updated_at on public.bot_messages;

alter table public.bot_messages
drop constraint if exists bot_messages_message_key_locale_key;

create unique index if not exists bot_messages_key_locale_uidx
  on public.bot_messages (key, locale);

-- presence: slim schema
alter table public.presence
drop column if exists user_uuid;

alter table public.presence
drop column if exists display_name;

alter table public.presence
drop column if exists role;

alter table public.presence
drop column if exists is_online;

alter table public.presence
drop column if exists created_at;

drop index if exists public.presence_room_online_idx;

create index if not exists presence_room_active_idx
  on public.presence (room_uuid, status)
  where status = 'entered'
    and left_at is null;
