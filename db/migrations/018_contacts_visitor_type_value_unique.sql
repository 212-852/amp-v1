delete from public.contacts a
using public.contacts b
where a.contact_uuid <> b.contact_uuid
  and a.visitor_uuid is not null
  and a.visitor_uuid = b.visitor_uuid
  and a.type = b.type
  and a.value = b.value
  and (
    a.updated_at < b.updated_at
    or (a.updated_at = b.updated_at and a.contact_uuid < b.contact_uuid)
  );

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'contacts'
      and indexdef like '%(visitor_uuid, type, value)%'
      and indexdef like 'CREATE UNIQUE INDEX%'
  ) then
    create unique index contacts_visitor_type_value_unique
      on public.contacts (visitor_uuid, type, value);
  end if;
end $$;
