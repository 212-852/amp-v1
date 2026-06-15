delete from public.contacts a
using public.contacts b
where a.contact_uuid <> b.contact_uuid
  and a.user_uuid is not null
  and a.user_uuid = b.user_uuid
  and a.type = b.type
  and a.value = b.value
  and (
    a.updated_at < b.updated_at
    or (a.updated_at = b.updated_at and a.contact_uuid < b.contact_uuid)
  );

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

drop index if exists contacts_user_type_value_uidx;
drop index if exists contacts_visitor_type_value_uidx;

create unique index contacts_user_type_value_uidx
  on public.contacts (user_uuid, type, value);

create unique index contacts_visitor_type_value_uidx
  on public.contacts (visitor_uuid, type, value);
