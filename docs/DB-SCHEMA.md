# DB-SCHEMA — IdeaVerdict v1 (Supabase Postgres)

All tables have RLS: owner sees own rows; `profiles.role='admin'` sees all. Timestamps `created_at`/`updated_at` everywhere (omitted below).

```sql
-- extends Supabase auth.users
profiles (
  id uuid PK REFERENCES auth.users,
  role text DEFAULT 'user',              -- 'user' | 'admin'
  plan text DEFAULT 'free',              -- 'free' | 'paid'
  free_credit_used boolean DEFAULT false,
  -- onboarding (personal feasibility inputs)
  occupation text,
  skills text[],                         -- e.g. {coding, marketing, design}
  weekly_hours text,                     -- '<5' | '5-15' | '15-30' | '30+'
  budget_range text,                     -- '<500' | '500-5k' | '5k-20k' | '20k+'
  work_preference text                   -- 'people' | 'building' | 'creative' | 'mixed'
)

analyses (
  id uuid PK,
  user_id uuid FK -> profiles,
  idea_text text NOT NULL,
  status text DEFAULT 'clarifying',
  -- 'clarifying' | 'queued' | 'running' | 'done' | 'insufficient_evidence' | 'failed'
  consumed_credit boolean DEFAULT false, -- false for insufficient_evidence/failed
  failure_code text NULL,                -- machine-safe reason, only when status='failed'
  trigger_run_id text,
  share_token text UNIQUE NULL,          -- set when sharing enabled
  share_enabled boolean DEFAULT false
)

analysis_questions (
  id uuid PK,
  analysis_id uuid FK,
  position int,                          -- 1..5
  question text,
  options jsonb,                         -- ["opt1","opt2","opt3","I don't know"]
  answer text NULL                       -- chosen option or free text
)

evidence_items (
  id uuid PK,
  analysis_id uuid FK,
  source text,                           -- 'reddit' | 'forum' | 'web'
  url text,
  quote text,
  author_handle text NULL,
  severity int,                          -- 1..3
  topic text,                            -- canonical complaint/topic label
  similar_count int DEFAULT 1            -- mentions grouped under this item
)

reports (
  id uuid PK,
  analysis_id uuid FK UNIQUE,
  score int NULL,                        -- 1..100, NULL if insufficient evidence
  verdict text,                          -- 'go' | 'caution' | 'stop' | 'insufficient'
  summary text,                          -- 2-3 sentences (also used in email)
  criteria jsonb,
  -- [{key:'problem_severity', score:int, reasoning:text, evidence_ids:[uuid]}, ...]
  solutions jsonb,                       -- MVP sketch, possible solutions
  plan jsonb NULL,                       -- realization plan (render-gated for free)
  insufficient_reason text NULL          -- why + what to try, when applicable
)

llm_costs (
  id uuid PK,
  analysis_id uuid FK NULL,
  stage text,                            -- 'questions'|'queries'|'extract'|'verdict'|'plan'
  model text,
  input_tokens int, output_tokens int,
  cost_usd numeric(8,4)
)

waitlist (
  id uuid PK,
  email text UNIQUE,
  source text NULL                       -- 'landing' | 'twitch' | ...
)
```

## Notes

- **Failures:** `failure_code` is a closed enum (`query_planning_failed`, `evidence_search_failed`, `evidence_extraction_failed`, `evidence_persist_failed`, `verdict_generation_failed`, `plan_generation_failed`, `report_persist_failed`, `timed_out`, `cancelled`, `unknown`), set only alongside `status='failed'` and NULL otherwise. The owner can read it under RLS, so it never carries raw exception text — the UI maps each code to friendly copy. `failed` is an error; `insufficient_evidence` is a valid outcome and never sets a code.
- **Credits:** free = `free_credit_used` flag; paid = count `analyses` with `consumed_credit=true` in current month < 10. One `status IN ('clarifying','queued','running')` analysis per user at a time (partial unique index).
- **Public share route** reads via `share_token` (+ `share_enabled=true`) using the service-role client in the `/r/[token]` server component (no auth); the query never selects `plan`, so the paid plan is absent from the shared payload.
- **Billing (week 4):** add `subscriptions` table fed by Lemon Squeezy webhooks (`ls_subscription_id`, status, renews_at); `profiles.plan` becomes derived. Manual toggle remains for admin.
- Migrations via Supabase CLI, checked into repo.
