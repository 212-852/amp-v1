delete from public.identities a
using public.identities b
where a.ctid <> b.ctid
  and a.provider = b.provider
  and a.provider_user_id is not null
  and a.provider_user_id = b.provider_user_id
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.ctid < b.ctid)
  );

create unique index if not exists identities_provider_user_idx
  on public.identities (provider, provider_user_id);
