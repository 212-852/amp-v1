delete from public.identities a
using public.identities b
where a.ctid <> b.ctid
  and a.provider = b.provider
  and a.external_user_id is not null
  and a.external_user_id = b.external_user_id
  and (
    a.updated_at < b.updated_at
    or (a.updated_at = b.updated_at and a.ctid < b.ctid)
  );

create unique index if not exists identities_provider_external_user_id_uidx
  on public.identities (provider, external_user_id);
