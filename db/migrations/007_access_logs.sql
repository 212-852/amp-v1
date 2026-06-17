create table access_logs (
  access_log_uuid uuid primary key default gen_random_uuid(),
  request_id text not null,
  category text not null,
  severity text not null,
  event text not null,
  pathname text not null,
  user_uuid uuid null,
  visitor_uuid uuid null,
  role text not null,
  tier text null,
  ip text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create unique index access_logs_request_id_event_uidx
  on access_logs (request_id, event);

create index access_logs_request_id_idx
  on access_logs (request_id);

create index access_logs_category_idx
  on access_logs (category);

create index access_logs_event_idx
  on access_logs (event);

create index access_logs_created_at_idx
  on access_logs (created_at desc);
