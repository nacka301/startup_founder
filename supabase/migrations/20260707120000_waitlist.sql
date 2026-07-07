-- Waitlist (DB-SCHEMA.md): email capture for the public landing page, live from
-- week 1 for build-in-public (PRD §12). Anonymous visitors submit their email via
-- a server action.
--
-- Write model matches the rest of the schema: the server action inserts with the
-- service-role key (after Zod validation), so there are NO insert grants or
-- policies for `anon`/`authenticated`. RLS is on with no grants — the table is
-- internal (only an admin, via the service role, ever reads it).

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,                   -- normalized to lowercase in the action
  source text,                                  -- 'landing' | 'twitch' | ...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_waitlist_updated_at
  before update on public.waitlist
  for each row
  execute function extensions.moddatetime (updated_at);

-- Row Level Security: enabled, no grants — every access goes through service-role.
alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
