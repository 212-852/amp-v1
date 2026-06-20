-- Realtime postgres_changes delivery requires SELECT via RLS for connecting role.
-- Filtered subscriptions also benefit from REPLICA IDENTITY FULL.

alter table public.messages replica identity full;

alter table public.messages enable row level security;

drop policy if exists messages_select_realtime on public.messages;

create policy messages_select_realtime on public.messages
  for select
  to anon, authenticated
  using (true);
