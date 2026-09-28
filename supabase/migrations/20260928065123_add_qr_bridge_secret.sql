create table if not exists public.integration_secrets (
  name text primary key,
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.integration_secrets enable row level security;

revoke all on table public.integration_secrets from public, anon, authenticated;
grant select on table public.integration_secrets to service_role;

insert into public.integration_secrets (name, secret_hash)
values ('qr_bridge', 'a1671167dd41f5afc60d3e7869c9d7813a38f7298531e1676310eb776374aa3a')
on conflict (name) do update
set secret_hash = excluded.secret_hash,
    updated_at = now();
