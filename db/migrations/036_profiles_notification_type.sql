alter table public.profiles
add column if not exists notification_type text not null default 'line';

alter table public.profiles
drop constraint if exists profiles_notification_type_check;

alter table public.profiles
add constraint profiles_notification_type_check
check (notification_type in ('line', 'push'));

notify pgrst, 'reload schema';
