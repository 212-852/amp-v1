create table if not exists public.otp (
  otp_uuid uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'line', 'sms')),
  target text not null,
  code text not null,
  purpose text not null check (
    purpose in ('login', 'register', 'verify', 'reset_password')
  ),
  visitor_uuid uuid,
  user_uuid uuid,
  attempt_count integer not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists otp_channel_target_purpose_idx
on public.otp (channel, target, purpose);

create index if not exists otp_code_idx
on public.otp (code);

create index if not exists otp_expires_at_idx
on public.otp (expires_at);
