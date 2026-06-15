create table if not exists public.email_codes (
  code_uuid uuid primary key default gen_random_uuid(),
  visitor_uuid uuid not null references public.visitors(visitor_uuid),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists email_codes_visitor_email_idx
  on public.email_codes (visitor_uuid, email, created_at desc);

create index if not exists email_codes_unconsumed_idx
  on public.email_codes (visitor_uuid, email)
  where consumed_at is null;
