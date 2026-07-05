# IdeaVerdict — project context

Web app that gives an evidence-backed verdict (score 1-100) on a user's business idea. Full context lives in `docs/` — READ the relevant docs before any task:

- `docs/PRD.md` — what we're building, scope, free vs paid (source of truth)
- `docs/ARCHITECTURE.md` — system design, analysis pipeline
- `docs/TECH-STACK.md` — fixed stack choices, conventions
- `docs/UI-STYLE-GUIDE.md` — design system, pages, tone
- `docs/DB-SCHEMA.md` — database schema

## Hard rules

- Stack is FIXED (Next.js 15 + TS, Tailwind + shadcn/ui, Supabase, Trigger.dev, Claude API, Resend, Lemon Squeezy). Never add or substitute libraries/services without asking David first.
- Never assume or improvise on product decisions. If PRD doesn't answer it, ASK — don't fill gaps.
- One task at a time. Only touch files relevant to the current task; never refactor unrelated code.
- Anything out of scope for v1 (see PRD §8) must not be built, even partially.
- All LLM prompts go in `src/prompts/` as versioned TS files. Zod-validate every LLM JSON response.
- Log every LLM call to `llm_costs`.
- All user-facing copy in English. Honest, direct tone — no hype.
- Never print or commit secrets; env vars only via `.env.local` (gitignored) and `.env.example`.

## Workflow expectations

- Before implementing: explain your plan and wait for approval.
- After implementing: state exactly how to test the result manually.
- Keep changes small and committable; suggest a commit message after each task.
