create table if not exists public.profiles (
  profile_uuid uuid primary key default gen_random_uuid(),
  user_uuid uuid null references public.users(user_uuid) on delete cascade,
  visitor_uuid uuid null references public.visitors(visitor_uuid) on delete cascade,
  nickname text null,
  first_name text null,
  last_name text null,
  birth_date date null,
  phone text null,
  prefecture_code text null,
  city_code text null,
  address text null,
  memo text null,
  locale text null check (locale in ('ja', 'en', 'es')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_uuid is not null or visitor_uuid is not null)
);

create unique index if not exists profiles_user_uuid_uidx
on public.profiles (user_uuid);

create unique index if not exists profiles_visitor_uuid_uidx
on public.profiles (visitor_uuid);

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function set_updated_at();

notify pgrst, 'reload schema';
