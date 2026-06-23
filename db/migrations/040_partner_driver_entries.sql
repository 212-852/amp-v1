create table if not exists public.partner_driver_entries (
  entry_uuid uuid primary key default gen_random_uuid(),
  user_uuid uuid null references public.users(user_uuid),
  visitor_uuid uuid null,
  line_user_id text null,
  source_channel text not null check (source_channel in ('web', 'pwa', 'liff', 'line')),
  name text not null,
  phone text not null,
  email text not null,
  prefecture_code text not null references public.prefectures(prefecture_code),
  city_code text not null references public.cities(city_code),
  prefecture text not null,
  city text not null,
  address text not null,
  car_owned boolean not null,
  license_owned boolean not null,
  available_days text not null,
  note text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists partner_driver_entries_user_uuid_idx
on public.partner_driver_entries(user_uuid);

create index if not exists partner_driver_entries_created_at_idx
on public.partner_driver_entries(created_at desc);

notify pgrst, 'reload schema';
