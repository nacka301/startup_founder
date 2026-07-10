# ARCHITECTURE — IdeaVerdict v1

## 1. System overview

```
Browser (Next.js app on Vercel)
   │
   ├── Supabase ── Auth (email magic link)
   │            ── Postgres (all data)
   │            ── Storage (none needed in v1)
   │
   ├── Next.js API routes ── create analysis, answer questions,
   │                         toggle share link, mini admin
   │
   └── Trigger.dev job: run_analysis(analysis_id)
          │
          ├── 1. Plan searches   (Sonnet: idea → search queries)
          ├── 2. Gather evidence (web search + reddit.com JSON endpoints)
          ├── 3. Extract/filter  (Haiku: relevant quotes, counts, severity)
          ├── 4. Score & verdict (Sonnet: criteria scores, 1-100, GO/CAUTION/STOP)
          ├── 5. Realization plan(Sonnet: MVP, weekly steps, marketing light)
          ├── 6. Persist report JSON → Postgres
          └── 7. Send email (Resend) with summary + report link
```

One repo, one deploy for the web app; Trigger.dev runs jobs (no own worker server, no queue table).

## 2. Components

- **Next.js (App Router)** on Vercel — landing, auth pages, onboarding, wizard, dashboard, report page, mini admin. Server components read Postgres directly via Supabase client; mutations via API routes/server actions.
- **Supabase** — Auth (magic link), Postgres with Row Level Security (users see only their rows; admin role bypass), no self-hosted services.
- **Trigger.dev** — long-running analysis job (5–10 min, retries, logs). Vercel functions never do heavy work.
- **Claude API** — Haiku = high-volume evidence reading; Sonnet = query planning, scoring, plan writing. Every call's token usage logged to `llm_costs`.
- **Resend** — transactional email (magic link is Supabase's own; report-ready email via Resend).

## 3. Analysis pipeline (detailed)

**Stage A — Clarify (interactive, before job starts).** API route sends idea text to Sonnet → returns 5 dynamic questions, each with 3–4 suggested answers + "I don't know". Stored in `analysis_questions`. Analysis job starts only after answers submitted.

**Stage B — Evidence (inside job).**
1. Sonnet generates 6–10 search queries from idea + answers (complaint-phrased: "annoyed with X", "why is there no Y").
2. For each query: web search restricted to reddit.com + relevant forums, plus direct `reddit.com/search.json` and `subreddit/search.json` calls. Collect top ~100 posts/comments total. Politeness: ≤1 req/sec, proper User-Agent, cache raw results per analysis.
3. Haiku batches (~20 items/call): keep only items genuinely about the problem; extract quote, permalink, severity 1–3. Deduplicate.
4. **Gate:** if fewer than N (start: 8) relevant evidence items → mark `insufficient_evidence`, generate the honest "not enough evidence" report, do NOT consume the free credit, stop.

**Stage C — Verdict.** Sonnet gets idea + answers + user profile + evidence set → JSON: criteria scores with reasoning (problem severity, competition, personal feasibility, monetization), total 1–100, verdict enum, solution/MVP sketch. Every claim must reference evidence item IDs (enforced in prompt + validated: claims without evidence refs get flagged).

**Stage D — Plan (paid content, always generated, gated at render).** Sonnet: MVP definition, week-by-week steps, tools, marketing-light. Stored with report; UI blurs it for free users.

**Stage E — Deliver.** Report JSON persisted; email sent with score + 2-sentence summary + link.

## 4. Report rendering & sharing

Report page renders from stored JSON (single renderer for free/paid/shared views). Share = user opt-in toggle → generates `share_token`; public route `/r/[token]` renders report without plan section, with app branding + CTA. Default private.

## 5. Error handling

- Every pipeline stage is wrapped so a thrown error becomes an `AnalysisFailure` carrying a machine-safe `failure_code`. The error still rethrows, so Trigger.dev retries (max 2) and the checkpointed evidence is reused.
- Job fails mid-way → still failing after retries → `onFailure` sets status `failed` + `failure_code`, sends an apologetic email (best-effort; a send failure can never fail the run), admin sees it in mini admin. Credit needs no refund: it's consumed only as the final write alongside the `done` flip, so a failed run never spends it.
- The run enforces its own 600s deadline between stages, well under the 900s `maxDuration`. This matters because Trigger.dev does **not** call `onFailure` when `maxDuration` is exceeded — the in-run deadline throws a normal error instead, so the analysis is always finalized rather than left stuck in `running`. A cancelled run is finalized by `onCancel`.
- Reddit blocked/rate-limited → fall back to general web search; if evidence still under gate → insufficient-evidence path.
- LLM returns invalid JSON → re-ask once with error message; then fail job.
- `failed` (an error) and `insufficient_evidence` (a valid outcome) are distinct states. The user is never shown raw exception text — the code maps to friendly copy on the report page.

## 6. Security & limits

RLS on all tables; share pages expose no user identity. Rate limits: 1 concurrent analysis per user (global rule), free = 1 lifetime credit, paid = 10/month. Admin = `role='admin'` on user row. Secrets only in Vercel/Trigger.dev env — never in repo or on stream.
