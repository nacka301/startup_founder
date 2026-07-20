-- reports.confidence — how much the verdict should be trusted, given how much
-- evidence backed it (PRD §11: verdicts must carry uncertainty). Judged by the
-- scoring stage (Stage C) from evidence volume/mix and stored alongside the
-- verdict; surfaced subtly under the verdict badge in the report header.
--
-- A closed set, nullable: NULL for legacy reports written before this column and
-- for the insufficient-evidence path (which produces no verdict to qualify).
-- No grant/policy change needed — the table-level SELECT grant to authenticated
-- (see 20260706140000_evidence_reports.sql) already covers new columns, and all
-- writes go through the service-role key inside the analysis job.

alter table public.reports
  add column confidence text
    check (confidence is null or confidence in ('low', 'moderate', 'high'));

comment on column public.reports.confidence is
  'Verdict confidence (''low''|''moderate''|''high''), judged from evidence volume/mix. NULL for legacy and insufficient-evidence reports.';
