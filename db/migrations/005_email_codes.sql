create table if not exists public.email_codes (
  code_uuid uuid primary key default gen_random_uuid(),
  visitor_uuid uuid not null,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_codes_lookup_idx
  on public.email_codes (visitor_uuid, email, created_at desc);
