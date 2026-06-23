alter table public.drivers
  add column if not exists business_notification_ready boolean not null default false,
  add column if not exists vehicle_ready boolean not null default false,
  add column if not exists black_plate_ready boolean not null default false,
  add column if not exists safety_manager_ready boolean not null default false;

alter table public.drivers
  drop constraint if exists drivers_status_check;

alter table public.drivers
  add constraint drivers_status_check
  check (
    status in (
      'provisional',
      'applied',
      'reviewing',
      'approved',
      'rejected'
    )
  );

alter table public.drivers
  alter column status set default 'provisional';

notify pgrst, 'reload schema';
