create table if not exists public.availability (
  user_uuid uuid primary key references public.users(user_uuid),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.availability (user_uuid, enabled, updated_at)
select
  updated_by,
  available,
  updated_at
from public.concierge_availability
where updated_by is not null
on conflict (user_uuid) do update
set
  enabled = excluded.enabled,
  updated_at = excluded.updated_at;

drop table if exists public.concierge_availability;

create trigger availability_set_updated_at
before update on public.availability
for each row
execute function set_updated_at();
