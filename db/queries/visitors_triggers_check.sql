select
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'visitors';

