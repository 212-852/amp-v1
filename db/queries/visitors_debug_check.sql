select
  visitor_uuid,
  user_uuid,
  source_channel,
  debug_source,
  debug_path,
  debug_request_id,
  debug_source_channel,
  created_at,
  updated_at
from public.visitors
order by created_at desc
limit 20;

