alter table public.rooms
add column if not exists thread_id text;

alter table public.rooms
add column if not exists thread_status text not null default 'closed';

update public.rooms
set thread_status = 'closed'
where thread_status is null;

alter table public.rooms
alter column thread_status set default 'closed';

alter table public.rooms
alter column thread_status set not null;

alter table public.rooms
drop constraint if exists rooms_thread_status_check;

alter table public.rooms
add constraint rooms_thread_status_check
check (thread_status in ('open', 'closed'));

create index if not exists rooms_thread_status_idx
on public.rooms (thread_status);

create index if not exists rooms_thread_id_idx
on public.rooms (thread_id)
where thread_id is not null;

notify pgrst, 'reload schema';
