-- Analysis wizard (ARCHITECTURE.md Stage A) tables: analyses, analysis_questions,
-- llm_costs. See docs/DB-SCHEMA.md. evidence_items / reports / waitlist belong to
-- later tasks and are intentionally not created here.
--
-- Write model: all writes to these tables go through the service-role key in
-- server actions (after ownership + gating checks), so there are NO insert/update
-- grants or policies for `authenticated`. RLS grants owners (and admins) SELECT
-- only — enough for the dashboard and wizard to read via the user's session.

-- analyses -------------------------------------------------------------------

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  idea_text text not null,
  status text not null default 'clarifying'
    check (status in (
      'clarifying', 'queued', 'running', 'done', 'insufficient_evidence', 'failed'
    )),
  consumed_credit boolean not null default false, -- false for insufficient_evidence/failed
  trigger_run_id text,
  share_token text unique,                         -- set when sharing enabled
  share_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index analyses_user_id_idx on public.analyses (user_id);

-- One active analysis per user at a time (ARCHITECTURE.md §6, DB-SCHEMA.md notes).
-- The application checks this first for a friendly message; this index is the
-- race-safe backstop.
create unique index analyses_one_active_per_user
  on public.analyses (user_id)
  where status in ('clarifying', 'queued', 'running');

create trigger set_analyses_updated_at
  before update on public.analyses
  for each row
  execute function extensions.moddatetime (updated_at);

-- analysis_questions ---------------------------------------------------------

create table public.analysis_questions (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  position int not null,                           -- 1..5
  question text not null,
  options jsonb not null,                          -- ["opt1","opt2","opt3","I don't know"]
  answer text,                                     -- chosen option, null until answered
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (analysis_id, position)
);

create index analysis_questions_analysis_id_idx
  on public.analysis_questions (analysis_id);

create trigger set_analysis_questions_updated_at
  before update on public.analysis_questions
  for each row
  execute function extensions.moddatetime (updated_at);

-- llm_costs ------------------------------------------------------------------
-- Append-only accounting; analysis_id is nullable and set null on delete so a
-- cost row survives if its analysis is rolled back after a paid call.

create table public.llm_costs (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references public.analyses (id) on delete set null,
  stage text not null,                             -- 'questions'|'queries'|'extract'|'verdict'|'plan'
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(8, 4) not null default 0,
  created_at timestamptz not null default now()
);

create index llm_costs_analysis_id_idx on public.llm_costs (analysis_id);

-- Row Level Security ---------------------------------------------------------
-- SELECT only for authenticated (RLS-gated); every write is service-role only.

alter table public.analyses enable row level security;
revoke all on public.analyses from anon, authenticated;
grant select on public.analyses to authenticated;

create policy "Analyses are viewable by owner or admin"
  on public.analyses for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

alter table public.analysis_questions enable row level security;
revoke all on public.analysis_questions from anon, authenticated;
grant select on public.analysis_questions to authenticated;

create policy "Analysis questions are viewable by owner or admin"
  on public.analysis_questions for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.analyses a
      where a.id = analysis_questions.analysis_id
        and a.user_id = (select auth.uid())
    )
  );

alter table public.llm_costs enable row level security;
revoke all on public.llm_costs from anon, authenticated;
grant select on public.llm_costs to authenticated;

-- Cost data is internal accounting: admins only (for the mini admin cost column).
create policy "LLM costs are viewable by admin"
  on public.llm_costs for select
  to authenticated
  using (public.is_admin());
