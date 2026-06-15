delete from public.identities a
using public.identities b
where a.ctid <> b.ctid
  and a.provider = b.provider
  and a.user_id is not null
  and a.user_id = b.user_id
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.ctid < b.ctid)
  );

create unique index if not exists identities_provider_userid_uidx
  on public.identities (provider, user_id);
