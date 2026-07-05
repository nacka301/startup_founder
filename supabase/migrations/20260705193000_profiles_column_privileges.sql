-- Lock down which profile columns a normal user may write.
--
-- The RLS UPDATE policy only gates the *row* (auth.uid() = id); it does not
-- restrict *columns*. Supabase's default grants give `authenticated` a
-- table-level UPDATE on public tables, which lets an owner rewrite any column
-- of their own row from the browser — including privilege/billing fields:
--   update profiles set role = 'admin'         -- self-grant admin
--   update profiles set plan = 'paid'          -- free billing bypass
--   update profiles set free_credit_used=false -- unlimited free analyses
--
-- Postgres IGNORES column-level revokes while a table-level UPDATE grant exists,
-- so we must drop the blanket UPDATE and re-grant UPDATE on onboarding columns
-- only. role / plan / free_credit_used become server-only (service_role / admin
-- via SECURITY DEFINER functions). RLS still enforces row ownership on top.

revoke update on public.profiles from anon, authenticated;

grant update (occupation, skills, weekly_hours, budget_range, work_preference)
  on public.profiles to authenticated;
