-- Evidence pipeline (ARCHITECTURE.md Stage B/C) tables: evidence_items, reports,
-- analysis_raw_evidence. See docs/DB-SCHEMA.md.
--
-- `reports` is created now (ahead of the scoring stage) because the Stage B
-- insufficient-evidence gate must write a report row with verdict='insufficient';
-- the scoring stage later fills in score/criteria/solutions/plan.
--
-- Write model matches 20260706120000_analyses.sql: every write goes through the
-- service-role key inside the analysis job, so there are NO insert/update grants
-- or policies for `authenticated`. RLS grants owners (and admins) SELECT only.

-- evidence_items -------------------------------------------------------------

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  source text not null,                            -- 'reddit' | 'forum' | 'web'
  url text not null,
  quote text not null,
  author_handle text,                              -- null when unknown
  severity int not null,                           -- 1..3
  topic text not null,                             -- canonical complaint/topic label
  similar_count int not null default 1,            -- mentions grouped under this item
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index evidence_items_analysis_id_idx
  on public.evidence_items (analysis_id);

create trigger set_evidence_items_updated_at
  before update on public.evidence_items
  for each row
  execute function extensions.moddatetime (updated_at);

-- reports --------------------------------------------------------------------
-- One report per analysis. Nullable columns are filled across stages: the
-- insufficient-evidence gate writes verdict/summary/insufficient_reason; scoring
-- fills score/criteria/solutions; the plan stage fills plan.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null unique references public.analyses (id) on delete cascade,
  score int,                                       -- 1..100, null if insufficient
  verdict text not null,                           -- 'go' | 'caution' | 'stop' | 'insufficient'
  summary text,                                    -- 2-3 sentences (also used in email)
  criteria jsonb,                                  -- [{key,score,reasoning,evidence_ids:[]}]
  solutions jsonb,                                 -- MVP sketch, possible solutions
  plan jsonb,                                      -- realization plan (render-gated for free)
  insufficient_reason text,                        -- why + what to try, when applicable
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_reports_updated_at
  before update on public.reports
  for each row
  execute function extensions.moddatetime (updated_at);

-- analysis_raw_evidence ------------------------------------------------------
-- Cache of the raw search payload (Tavily + Reddit) per analysis, so a
-- Trigger.dev retry re-uses the already-fetched candidates instead of hitting
-- Reddit again. Internal only — never rendered to users.

create table public.analysis_raw_evidence (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null unique references public.analyses (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Row Level Security ---------------------------------------------------------
-- SELECT only for authenticated (RLS-gated); every write is service-role only.

alter table public.evidence_items enable row level security;
revoke all on public.evidence_items from anon, authenticated;
grant select on public.evidence_items to authenticated;

create policy "Evidence items are viewable by owner or admin"
  on public.evidence_items for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.analyses a
      where a.id = evidence_items.analysis_id
        and a.user_id = (select auth.uid())
    )
  );

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;

create policy "Reports are viewable by owner or admin"
  on public.reports for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.analyses a
      where a.id = reports.analysis_id
        and a.user_id = (select auth.uid())
    )
  );

-- Raw evidence is internal accounting/cache: admins only (like llm_costs).
alter table public.analysis_raw_evidence enable row level security;
revoke all on public.analysis_raw_evidence from anon, authenticated;
grant select on public.analysis_raw_evidence to authenticated;

create policy "Raw evidence is viewable by admin"
  on public.analysis_raw_evidence for select
  to authenticated
  using (public.is_admin());
