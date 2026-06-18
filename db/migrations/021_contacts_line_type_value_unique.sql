-- LINE contacts upsert uses on_conflict=(type,value).
-- Ensure a matching unique index exists for PostgREST.

create unique index if not exists contacts_type_value_unique
  on public.contacts (type, value);
