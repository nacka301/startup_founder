-- Track whether a user has finished the one-time onboarding screen.
--
-- We can't infer completion from the answer columns: every question offers a
-- "prefer not to say" option, so any of them may be legitimately blank/null for
-- a fully-onboarded user. A dedicated timestamp is the unambiguous signal.

alter table public.profiles
  add column onboarding_completed_at timestamptz;

-- Onboarding is user-owned data, so let the owner write this column — same as
-- the other onboarding fields. The privilege/billing columns (role, plan,
-- free_credit_used) stay server-only; RLS still enforces row ownership.
grant update (onboarding_completed_at) on public.profiles to authenticated;
