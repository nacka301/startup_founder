# PRD — IdeaVerdict (working title)

**Version:** 1.0 · **Owner:** David · **Target:** public v1 in 4 weeks (30+ h/week, built in public on Twitch)

## 1. One-liner

A web app that gives an honest, evidence-backed verdict on your business idea: a 1–100 score, real quotes from people complaining about the problem online, and (paid) a concrete realization plan.

## 2. Problem

Ambitious people who want to start something get stuck between "I have an idea but don't know if it's good" and "I have no way to check except asking friends." Existing options: biased friends, expensive consultants, or weeks of manual Reddit digging. Result: they either build the wrong thing or never start.

## 3. Target user

Ambitious would-be founders (not only developers) who are willing to invest time/money to build a business but lack confidence in their idea. Technical level: mixed — UI must not assume coding knowledge. Market: global, English-language product.

## 4. Roles

- **User** — free or paid. One account = one person (email magic-link auth).
- **Admin** (David) — mini admin page: list users/analyses, toggle paid manually, view LLM cost per analysis.

## 5. Core user flow (v1)

1. Landing page → "Get a verdict on your idea" → sign up with email (magic link). Registration required before the free analysis (abuse prevention).
2. Onboarding profile (once): what you do, skills, weekly time available, budget range, what kind of work you enjoy (communicating / coding / creative). Used for the personal feasibility score.
3. New analysis wizard: user describes idea in free text → AI generates **5 dynamic clarification questions**, each with suggested answers + "I don't know" (a legitimate answer the AI accounts for).
4. Analysis runs in background (target 5–10 min). User can leave; email arrives when done.
5. **Free:** email with score + short summary + link to the full web report. **Paid:** full dashboard access, unlimited analyses (fair-use limit 10/month), realization plan per idea.
6. Report page (see §6). Free users see the realization plan section blurred/locked with a paid CTA (the upsell moment).
7. User can share a report via opt-in public link (app-branded). Private by default.

## 6. The report (the product)

Must contain, in this order:

1. **Score 1–100 + verdict**: GO / CAUTION / STOP, one-paragraph reasoning.
2. **Criteria breakdown** (each scored, each with reasoning): problem severity & frequency, existing competition & their weaknesses, personal feasibility (uses profile), monetization potential.
3. **Evidence section**: for every major claim — 2–3 real quotes from Reddit/forums with links + count of similar mentions found ("we found 34 similar complaints"); click expands the full list. Full transparency on where the AI looked and how it concluded.
4. **Possible solutions & MVP shape**: what a first version could look like.
5. **Realization plan** (paid, locked/blurred for free): MVP definition, week-by-week steps to launch, suggested tools/stack, marketing-light section (where to find first customers). One document per idea.

**Insufficient evidence rule:** if live search finds too little (idea too vague, exotic niche), the report honestly says "not enough evidence, here's why and what to try" — and the free analysis is **not consumed**; the user may retry.

## 7. Free vs paid

| | Free | Paid |
|---|---|---|
| Analyses | 1 (not consumed on insufficient evidence) | 10/month fair use |
| Delivery | email summary + web report link | dashboard + email |
| Realization plan | locked (blurred teaser) | included |
| Share link | yes (opt-in) | yes (opt-in) |

Price: **TBD after launch** (structure fixed, number tested later). Billing via **Lemon Squeezy or Paddle** (merchant of record — handles EU VAT). Until billing ships, admin can toggle paid manually.

## 8. Out of scope for v1 (explicitly v2+)

Idea *discovery* mode (user enters interests → AI finds ideas), idea tracking over time + notifications ("new evidence for your idea"), full marketing plan & KPI dashboards, pre-indexed evidence database, full admin panel (stats, refunds, bans), multi-language reports, teams/collaboration.

## 9. Success metrics

- 3 months post-launch: **100 completed free analyses, 5 paying customers.**
- Personal check: David runs his own ideas through it and finds the verdicts useful.
- Quality bar: every report's evidence links must actually support the claims (manual QA during weeks 1–2 post-launch).

## 10. Name candidates

Working title **IdeaVerdict**. Candidates to check on Namecheap (availability not yet verified): ideaverdict.com, ideaproof.com, ideagauge.com, ideajury.com, vettedidea.com, proofmyidea.com, verdictly.com, buildworthy.com. Option: let Twitch chat vote (build-in-public moment).

## 11. Risks

- **Evidence quality** = the product. Weeks 1–2 after each pipeline change: manually review reports, tune prompts.
- **LLM cost:** target ≤ ~1 €/analysis (Haiku for evidence reading, Sonnet for scoring/plan). Log cost per analysis from day 1; free tier capped at 1 analysis/user.
- **Reddit access:** live search via web search + Reddit JSON endpoints (no official OAuth API in v1). Rate-limit politely; fallback to general web search if blocked.
- **Overpromising:** verdicts must include uncertainty language; disclaimer that this is research assistance, not guaranteed business advice.
- **Streaming leaks:** API keys/.env never on screen (secrets manager + scene switch).
- **RLS regression coverage:** privilege/billing columns (`role`, `plan`, `free_credit_used`) are protected by column-level grants, verified manually for now. Add an automated RLS regression test (normal user must not write those columns) once the product is working — manual verification is enough for MVP.

## 12. Build-in-public notes

Weekly milestones streamed on Twitch; landing page + waitlist live from week 1 (`!waitlist` chat command); clip firsts (first analysis, first verdict, first paying user) for X/IndieHackers.
