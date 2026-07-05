# UI-STYLE-GUIDE — IdeaVerdict v1

## Direction

Clean, light SaaS (Linear/Notion feel). The product sells **trust in a verdict** — design must feel calm, precise, professional. No playful illustrations, no dark mode in v1.

## Foundations

- **Background:** white `#FFFFFF`; section alt `#FAFAF9` (stone-50). Cards: white, border `#E7E5E4`, radius 12px, shadow-sm only.
- **Text:** primary `#1C1917` (stone-900), secondary `#78716C` (stone-500).
- **Accent (one color):** indigo `#4F46E5` — buttons, links, active states, score ring.
- **Verdict colors (only place with more color):** GO `#16A34A`, CAUTION `#D97706`, STOP `#DC2626`. Used for verdict badge, score ring, criteria bars — nowhere else.
- **Typography:** Inter (via next/font). Sizes: h1 30/semibold, h2 20/semibold, body 15/regular, caption 13. Score number on report: 56/bold.
- **Spacing:** 4px scale; generous whitespace; max content width 720px for reports, 1100px for dashboard.

## Components (shadcn/ui base)

Button (primary indigo, secondary outline), Card, Input/Textarea, Radio-card for wizard answer options (selected = indigo border + light indigo bg), Badge for verdict, Progress bars for criteria scores, Skeletons for loading, Dialog for share confirm.

**Signature components:**
- **ScoreRing** — circular gauge, 1–100, colored by verdict, animates on load.
- **EvidenceCard** — quote in serif italic, source favicon + subreddit/forum name, permalink out-icon, "34 similar mentions" pill that expands the full list.
- **LockedPlan** — realization plan rendered but blurred (CSS blur + overlay), lock icon, "Upgrade to unlock your realization plan" CTA. Must look real, not like an empty placeholder.

## Pages (v1 inventory)

1. Landing — hero ("Get an honest verdict on your business idea"), how-it-works 3 steps, sample report screenshot, email signup CTA, waitlist section.
2. Auth (magic link sent / callback)
3. Onboarding profile (one screen, radio-cards)
4. Dashboard — analyses list with status chips (clarifying / running / done / insufficient evidence / failed)
5. New analysis wizard — step 1 idea textarea, step 2 the 5 AI questions (radio-cards + "I don't know"), step 3 confirmation "we're on it, email coming"
6. Report page (see components above; shared public variant `/r/[token]` adds top banner + bottom CTA)
7. Account (email, plan, usage)
8. Mini admin (table views, paid toggle, LLM cost column)

## Tone of voice (report copy)

Honest, direct, evidence-first. Never hype ("This WILL succeed"), never vague ("might be interesting"). Pattern: claim → evidence → implication. Uncertainty is stated explicitly. English only.
