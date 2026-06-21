alter table public.profiles
add column if not exists notification_type text not null default 'line';

alter table public.profiles
drop constraint if exists profiles_notification_type_check;

update public.profiles
set notification_type = 'pwa_push'
where notification_type = 'push';

alter table public.profiles
add constraint profiles_notification_type_check
check (notification_type in ('line', 'pwa_push'));

notify pgrst, 'reload schema';

