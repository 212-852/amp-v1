alter table public.contacts
alter column value drop not null;

drop index if exists contacts_push_endpoint_unique;
drop index if exists contacts_type_value_unique;
drop index if exists contacts_user_type_value_unique;
drop index if exists contacts_user_type_value_uidx;
drop index if exists contacts_visitor_type_value_unique;
drop index if exists contacts_visitor_type_value_uidx;

update public.contacts
set
  value = null,
  endpoint = null,
  p256dh = null,
  auth = null,
  user_agent = null,
  updated_at = now()
where type = 'line';

update public.contacts
set
  value = endpoint,
  user_agent = null,
  updated_at = now()
where type = 'push';

with ranked as (
  select
    contact_uuid,
    row_number() over (
      partition by user_uuid
      order by
        case when type in ('line', 'push') then 0 else 1 end,
        case when receive = true then 0 else 1 end,
        updated_at desc,
        contact_uuid desc
    ) as row_number
  from public.contacts
  where user_uuid is not null
)
delete from public.contacts
where contact_uuid in (
  select contact_uuid
  from ranked
  where row_number > 1
);

with ranked as (
  select
    contact_uuid,
    row_number() over (
      partition by visitor_uuid
      order by
        case when type in ('line', 'push') then 0 else 1 end,
        case when receive = true then 0 else 1 end,
        updated_at desc,
        contact_uuid desc
    ) as row_number
  from public.contacts
  where visitor_uuid is not null
    and user_uuid is null
)
delete from public.contacts
where contact_uuid in (
  select contact_uuid
  from ranked
  where row_number > 1
);

create unique index if not exists contacts_user_single_idx
on public.contacts(user_uuid)
where user_uuid is not null;

create unique index if not exists contacts_visitor_single_idx
on public.contacts(visitor_uuid)
where visitor_uuid is not null
  and user_uuid is null;

notify pgrst, 'reload schema';
