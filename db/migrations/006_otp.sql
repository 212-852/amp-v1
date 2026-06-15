create table if not exists public.otp (
  otp_uuid uuid primary key default gen_random_uuid(),

  visitor_uuid uuid,
  user_uuid uuid,

  purpose text not null,
  channel text not null,
  target text not null,

  code_hash text not null,

  expires_at timestamptz not null,
  consumed_at timestamptz,

  attempt_count integer not null default 0,
  max_attempt_count integer not null default 5,

  created_at timestamptz not null default now()
);

create index if not exists otp_lookup_idx
on public.otp (purpose, channel, target, visitor_uuid, created_at desc);

create index if not exists otp_expiry_idx
on public.otp (expires_at);
