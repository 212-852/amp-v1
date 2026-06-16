create table if not exists public.login_bridge (
  bridge_uuid uuid primary key default gen_random_uuid(),
  visitor_uuid uuid not null,
  provider text not null,
  status text not null default 'pending',
  user_uuid uuid,
  source_channel text not null,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists login_bridge_visitor_idx
on public.login_bridge (visitor_uuid, created_at desc);

create index if not exists login_bridge_status_expiry_idx
on public.login_bridge (status, expires_at);
