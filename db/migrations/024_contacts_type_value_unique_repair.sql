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

create unique index if not exists contacts_type_value_unique
  on public.contacts (type, value);

notify pgrst, 'reload schema';
