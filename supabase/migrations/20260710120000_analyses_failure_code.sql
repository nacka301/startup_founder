-- analyses.failure_code — why a run ended as status='failed' (ARCHITECTURE.md §5).
--
-- A closed set of machine-safe codes, never raw exception text: the owner can
-- SELECT this column under the existing RLS policy, so the value is mapped to
-- friendly copy in the UI and must never leak an error message, stack, or secret.
-- Set only alongside status='failed'; NULL for every other status.

alter table public.analyses
  add column failure_code text
    check (failure_code is null or failure_code in (
      'query_planning_failed',
      'evidence_search_failed',
      'evidence_extraction_failed',
      'evidence_persist_failed',
      'verdict_generation_failed',
      'plan_generation_failed',
      'report_persist_failed',
      'timed_out',
      'cancelled',
      'unknown'
    ));

comment on column public.analyses.failure_code is
  'Machine-safe reason a run failed. Set only with status=''failed''. Never raw error text.';
