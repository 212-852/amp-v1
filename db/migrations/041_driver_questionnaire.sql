create table if not exists public.drivers (
  driver_uuid uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references public.users(user_uuid) on delete cascade,
  has_driver_license boolean not null default false,
  vehicle_status text not null check (
    vehicle_status in ('owned', 'planned', 'consult')
  ),
  freight_operator_status text not null check (
    freight_operator_status in ('obtained', 'applying', 'unknown', 'consult')
  ),
  safety_manager_status text not null check (
    safety_manager_status in ('obtained', 'planned', 'unknown', 'consult')
  ),
  pet_experience text[] not null default '{}'::text[],
  transport_experience text not null check (
    transport_experience in ('yes', 'no')
  ),
  application_reason text not null,
  status text not null default 'applied' check (
    status in ('applied', 'reviewing', 'approved', 'rejected')
  ),
  entry_uuid uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drivers_user_uuid_idx on public.drivers(user_uuid);
create index if not exists drivers_status_idx on public.drivers(status);

drop trigger if exists drivers_set_updated_at on public.drivers;

create trigger drivers_set_updated_at
before update on public.drivers
for each row
execute function set_updated_at();

alter table public.partner_driver_entries
  add column if not exists status text not null default 'applied',
  add column if not exists driver_uuid uuid null references public.drivers(driver_uuid);

alter table public.partner_driver_entries
  alter column name drop not null,
  alter column phone drop not null,
  alter column email drop not null,
  alter column prefecture_code drop not null,
  alter column city_code drop not null,
  alter column prefecture drop not null,
  alter column city drop not null,
  alter column address drop not null,
  alter column car_owned drop not null,
  alter column license_owned drop not null,
  alter column available_days drop not null;

notify pgrst, 'reload schema';
