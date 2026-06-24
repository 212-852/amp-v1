alter table public.drivers
  drop constraint if exists drivers_status_check;

update public.drivers
set status = 'provisional'
where status = 'preparing';

alter table public.drivers
  alter column status set default 'provisional';

alter table public.drivers
  add constraint drivers_status_check
  check (status in ('provisional', 'active', 'suspended', 'retired'));

notify pgrst, 'reload schema';
