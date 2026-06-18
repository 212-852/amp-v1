alter table public.messages
add column if not exists source_channel text
  check (source_channel is null or source_channel in ('web', 'pwa', 'liff', 'line'));

alter table public.messages
add column if not exists external_id text;

create unique index if not exists messages_source_channel_external_id_uidx
  on public.messages (source_channel, external_id)
  where source_channel is not null
    and external_id is not null;

notify pgrst, 'reload schema';
