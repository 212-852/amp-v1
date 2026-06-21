alter table public.contacts
add column if not exists endpoint text,
add column if not exists p256dh text,
add column if not exists auth text,
add column if not exists user_agent text;

update public.contacts
set endpoint = value
where type = 'push'
  and endpoint is null;

create unique index if not exists contacts_push_endpoint_unique
on public.contacts(endpoint)
where type = 'push'
and endpoint is not null;

notify pgrst, 'reload schema';

