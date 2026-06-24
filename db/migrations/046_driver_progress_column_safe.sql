alter table public.drivers
  add column if not exists driver_progress jsonb not null default '{}'::jsonb;

update public.drivers
set driver_progress = coalesce(driver_progress, '{}'::jsonb);

notify pgrst, 'reload schema';
