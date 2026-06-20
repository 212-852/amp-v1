alter table public.availability
add column if not exists notification_type text not null default 'line';

alter table public.availability
drop constraint if exists availability_notification_type_check;

alter table public.availability
add constraint availability_notification_type_check
check (notification_type in ('line', 'push'));
