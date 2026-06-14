alter table public.visitors
add column if not exists debug_source text,
add column if not exists debug_path text,
add column if not exists debug_request_id text,
add column if not exists debug_source_channel text;

