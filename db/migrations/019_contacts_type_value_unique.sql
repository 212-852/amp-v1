delete from public.contacts a
using public.contacts b
where a.contact_uuid <> b.contact_uuid
  and a.type = b.type
  and a.value = b.value
  and (
    (a.user_uuid is null and b.user_uuid is not null)
    or (
      (a.user_uuid is null) = (b.user_uuid is null)
      and (
        a.updated_at < b.updated_at
        or (a.updated_at = b.updated_at and a.contact_uuid < b.contact_uuid)
      )
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'contacts'
      and indexdef like '%(type, value)%'
      and indexdef like 'CREATE UNIQUE INDEX%'
  ) then
    create unique index contacts_type_value_unique
      on public.contacts (type, value);
  end if;
end $$;
