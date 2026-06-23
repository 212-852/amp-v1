alter table public.drivers
  drop column if exists business_notification_ready,
  drop column if exists vehicle_ready,
  drop column if exists black_plate_ready,
  drop column if exists safety_manager_ready,
  drop column if exists entry_uuid;

alter table public.drivers
  drop constraint if exists drivers_vehicle_status_check;

alter table public.drivers
  drop constraint if exists drivers_freight_operator_status_check;

alter table public.drivers
  drop constraint if exists drivers_safety_manager_status_check;

alter table public.drivers
  drop constraint if exists drivers_transport_experience_check;

alter table public.drivers
  drop constraint if exists drivers_status_check;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'drivers'
      and column_name = 'vehicle_status'
  ) then
    alter table public.drivers rename column vehicle_status to vehicle;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'drivers'
      and column_name = 'freight_operator_status'
  ) then
    alter table public.drivers rename column freight_operator_status to freight_operator;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'drivers'
      and column_name = 'safety_manager_status'
  ) then
    alter table public.drivers rename column safety_manager_status to safety_manager;
  end if;
end $$;

alter table public.drivers
  add column if not exists black_plate text;

alter table public.drivers
  alter column vehicle drop not null,
  alter column freight_operator drop not null,
  alter column safety_manager drop not null,
  alter column transport_experience drop not null,
  alter column application_reason drop not null;

update public.drivers
set status = 'preparing'
where status is null
   or status not in ('preparing', 'active', 'suspended', 'retired');

alter table public.drivers
  alter column status set default 'preparing';

alter table public.drivers
  add constraint drivers_status_check
  check (status in ('preparing', 'active', 'suspended', 'retired'));

drop index if exists public.drivers_user_uuid_idx;

create unique index if not exists drivers_user_uuid_unique
  on public.drivers (user_uuid);

notify pgrst, 'reload schema';
