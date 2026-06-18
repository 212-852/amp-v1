-- LINE contacts upsert uses on_conflict=(type,value).
-- Ensure a matching unique index exists for PostgREST.

drop index if exists public.contacts_type_value_unique;

create unique index contacts_type_value_unique
  on public.contacts (type, value);
