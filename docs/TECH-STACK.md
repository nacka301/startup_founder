# TECH-STACK — IdeaVerdict v1

Fixed choices. AI assistants working on this project must NOT substitute other libraries/services without David's approval.

## Core

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | One language front+back, Vercel deploy, David's choice |
| UI | **Tailwind CSS + shadcn/ui** | Fast clean-SaaS look, matches style guide |
| Auth | **Supabase Auth** — email magic link only | No passwords, matches "email is identity" |
| Database | **Supabase Postgres + RLS** | Managed, free tier, one place for all data |
| Background jobs | **Trigger.dev** | 5–10 min jobs, retries, logs; free tier OK |
| LLM | **Claude API**: claude-haiku (evidence extraction), claude-sonnet (questions, scoring, plan) | Cost target ≤ ~1 €/analysis |
| Web search | Search API (Tavily or Brave Search API — pick in week 1 spike) + reddit `.json` endpoints via fetch | No official Reddit OAuth in v1 |
| Email | **Resend** + react-email templates | Simple, free tier |
| Billing | **Lemon Squeezy** (fallback: Paddle) | Merchant of record → handles EU VAT for HR solo dev. Integrated week 4; manual paid-toggle until then |
| Hosting | **Vercel** (app) + Supabase cloud + Trigger.dev cloud | Zero servers to maintain |
| Analytics | **Plausible or Umami** | Privacy-friendly, one script |

## Conventions

- Zod schemas for every LLM JSON response; validate + one retry on parse failure.
- All LLM prompts live in `/src/prompts/` as versioned TS files — never inline in business logic.
- Every LLM call logs model, tokens, cost → `llm_costs` table.
- Feature work: one feature = one chat/branch; PRD.md + relevant doc always in context.
- Env vars documented in `.env.example` (never real values). Keys: SUPABASE_*, ANTHROPIC_API_KEY, TRIGGER_*, RESEND_API_KEY, SEARCH_API_KEY, LEMONSQUEEZY_*.

## Monthly cost estimate (MVP phase)

Vercel free, Supabase free, Trigger.dev free tier, Resend free, search API ~0–30 €, Claude ~1 €/analysis → at 100 free analyses ≈ 100–150 €/month worst case. Hard cap: free tier limited to 1 analysis; alert in mini admin when monthly LLM spend crosses 100 €.
