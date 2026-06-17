alter table public.messages
add column if not exists type text not null default 'text'
  check (type in ('text', 'image', 'file', 'location', 'flex', 'system', 'typing'));

create index if not exists messages_type_idx
  on public.messages (type);
