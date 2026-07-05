-- profiles: extends auth.users with app-level fields + onboarding inputs.
-- See docs/DB-SCHEMA.md.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user',            -- 'user' | 'admin'
  plan text not null default 'free',            -- 'free' | 'paid'
  free_credit_used boolean not null default false,
  -- onboarding (personal feasibility inputs)
  occupation text,
  skills text[],                                -- e.g. {coding, marketing, design}
  weekly_hours text,                            -- '<5' | '5-15' | '15-30' | '30+'
  budget_range text,                            -- '<500' | '500-5k' | '5k-20k' | '20k+'
  work_preference text,                         -- 'people' | 'building' | 'creative' | 'mixed'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh on every row update.
create extension if not exists moddatetime schema extensions;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function extensions.moddatetime (updated_at);

-- Auto-create a profile row when a new auth user signs up. SECURITY DEFINER so
-- the insert bypasses RLS.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Row Level Security ---------------------------------------------------------

alter table public.profiles enable row level security;

-- Is the current user an admin? SECURITY DEFINER so this lookup itself bypasses
-- RLS — which prevents infinite recursion in the policies below.
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Owner sees own row; admins see all.
create policy "Profiles are viewable by owner or admin"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id or public.is_admin());

-- Owner can update own row; admins can update any.
create policy "Profiles are updatable by owner or admin"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

-- Note: INSERT is handled exclusively by the handle_new_user() trigger, so no
-- INSERT policy is granted to users.
