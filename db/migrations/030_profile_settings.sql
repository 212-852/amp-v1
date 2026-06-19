alter table if exists public.users
add column if not exists notification_preference text not null default 'all'
  check (notification_preference in ('all', 'mentions', 'none'));

alter table if exists public.users
add column if not exists locale text null
  check (locale in ('ja', 'en', 'es'));

alter table if exists public.visitors
add column if not exists display_name text null,
add column if not exists image_url text null,
add column if not exists locale text null
  check (locale in ('ja', 'en', 'es')),
add column if not exists notification_preference text not null default 'all'
  check (notification_preference in ('all', 'mentions', 'none'));

notify pgrst, 'reload schema';
