# UI-STYLE-GUIDE — IdeaVerdict v1

## Direction

**Dark premium SaaS** (Linear / Vercel / Stripe tier). The product sells **trust in a verdict** — design must feel calm, precise, premium, and authoritative. Dark surfaces focus attention on the verdict; restricted semantic colors (GO/CAUTION/STOP) keep the verdict unambiguous and trustworthy.

## Foundations

### Color palette (dark-first)
All colors tuned for WCAG AA contrast on dark surfaces.

**Backgrounds & surfaces:**
- Base: `#0A0B10` (near-black slate, `--background`); used for page background.
- Card/elevated: `#14161D` (`--card`); primary surface for interactive content.
- Higher: `#1B1E27` (`--surface-2`); section-alt, backgrounds for secondary content.

**Text:**
- Primary: `#F3F4F6` (off-white, `--foreground`); ~11:1 contrast on base.
- Secondary: `#9CA3AF` (gray, `--muted-foreground`); ~7:1 on base, passes AA.

**Primary accent — indigo→violet gradient:**
- Indigo: `#6366F1` (`--primary`); solid buttons, links, focus rings.
- Violet: `#8B5CF6` (`--gradient-to`); gradient CTAs on landing hero & key marketing moments.
- Foreground: `#F8FAFC` (near-white); text on primary/gradient buttons.

**Semantic verdict colors (only place more color appears):**
- GO: `#22C55E` (emerald); used in verdict badge, score ring, criteria bars.
- CAUTION: `#F59E0B` (amber); clear, distinct from GO.
- STOP: `#EF4444` (red); highest alert level.
- Badge alpha: `${color}1a` (6% opacity) for subtle backgrounds.

**Borders & inputs:**
- Hairlines: `rgba(255, 255, 255, 0.08)` (translucent light, `--border`).
- Input fields: `rgba(255, 255, 255, 0.14)` (`--input`); more visible than hairlines.
- Focus ring: indigo `#6366F1`, 3px width, 50% opacity.

### Psychology rationale
- **Indigo + violet:** Intelligence, innovation, premium authority. Indigo carries precision (verdict-as-science); violet adds sophistication.
- **Dark surfaces:** High-end feel, reduces visual fatigue, focuses attention on content. Professional, not "hacker."
- **Reserved semantic colors:** GO/CAUTION/STOP are the ONLY places color appears for meaning. Makes the verdict read as unambiguous & trustworthy — not decorative.
- **Hairline borders:** Subtle separation without visual noise; elegant restraint.

### Typography
**Font:** Inter (via `next/font`, no extra dependency). Tight tracking on large headings.

**Scale:**
- h1: 36px / semibold / tight tracking
- h2: 24px / semibold / tight tracking
- h3: 20px / medium
- body: 15px / regular / relaxed line-height
- caption: 13px / regular / muted text
- Score display (report): 56px / bold / leading-none

**Tracking:** Default tight for headings (–0.015em); body relaxed (normal).

### Spacing
**4px scale,** generous whitespace:
- Section vertical: 64–96px (py-16 to py-24)
- Card padding: 24px (p-6, `--card-spacing`)
- Gap between elements: 16px (gap-4)
- Max content width: 720px (reports), 1100px (dashboard/admin)

### Border radius
**`--radius: 0.75rem`** (12px); consistent softness across cards, buttons, inputs. Scaled:
- sm: 0.45rem (7.2px) — tiny elements
- md: 0.6rem (9.6px) — inputs, badges
- lg: 0.75rem (12px) — cards, buttons
- xl–4xl: larger radius for emphasis

### Elevation & glow
**Shadow helpers** (CSS utilities in `globals.css`):
- `.shadow-elevated`: 3-layer soft shadow for raised cards.
  ```
  0 1px 2px rgba(0,0,0,0.3),
  0 4px 12px rgba(0,0,0,0.25),
  0 12px 24px rgba(0,0,0,0.2)
  ```
- `.shadow-glow`: elevated + indigo glow for premium CTAs & verdict cards.
  ```
  0 0 20px rgba(99,102,241,0.25),  /* indigo glow */
  0 1px 2px rgba(0,0,0,0.3),
  0 4px 12px rgba(0,0,0,0.25)
  ```

**Verdict glow:** Verdict-colored glow (e.g., emerald for GO) at 20% opacity on the verdict card, so the color reinforces the verdict without being overwhelming.

### Motion
**Animations:**
- **Fade-in-up:** Elements slide up 12px + fade on load. `@keyframes fade-in-up 0.6s ease-out` → `.animate-fade-in-up`. Stagger by 0.1s per element for cascade effect.
- **Smooth transitions:** All interactive elements (buttons, hovers, focus) get `transition-all` + 150ms duration (Tailwind default).
- **Score ring:** Circular stroke-dashoffset animation, 1s ease-out, on report load (already in place, respects reduced-motion).

**Reduced motion:** When `@media (prefers-reduced-motion: reduce)`, all animations disabled (`animation: none !important`), transitions shortened to 1ms.

## Components (shadcn/ui base + custom)

**Button** (`src/components/ui/button.tsx`):
- default: solid indigo, hover lighter indigo
- **gradient** (NEW): indigo→violet gradient + glow, reserved for landing hero & key marketing CTAs
- outline: light border, hover raised background
- secondary / ghost: muted backgrounds for tertiary actions
- destructive: low-saturation red, for destructive actions only

**Card** (`src/components/ui/card.tsx`):
- Elevated surface with hairline border + soft shadow. Dark background, light text. Consistent radius & spacing.

**Input / Textarea**: Translucent light borders on dark card background. Focus = indigo ring.

**RadioCardGroup** (signature, `src/components/ui/radio-card.tsx`):
- Unselected: dark card, hairline border, hover shadow elevation.
- Selected: indigo border + soft indigo background + ring + glow. Feels premium & interactive.

**Signature components** (required by PRD):
- **ScoreRing** — circular gauge, 1–100, colored by verdict (GO/CAUTION/STOP). Animates on load (respects reduced-motion).
- **VerdictHeader** — elevated card with verdict-colored glow. Score ring + badge + summary.
- **EvidenceCard** — serif italic quote, source, link, "N similar mentions" pill. Card styling with hairline border.
- **LockedPlan** — blurred placeholder plan + lock icon + premium CTA. Blur overlay gradient to dark base. Server-side gating ensures real plan never reaches free user HTML.

## Pages (v1 inventory)

1. **Landing** — hero with gradient CTA + glow, how-it-works, sample report, pricing (Paid gets glow), waitlist. Fade-in-up cascades. Section-alt bands alternate `bg-surface` & `bg-background`.
2. **Auth (login)** — magic link + OTP code. Elevated Card on dark background.
3. **Onboarding profile** — radio-card questions. One-thing-at-a-time layout.
4. **Dashboard** — analyses list as card rows. Clean list styling.
5. **New analysis wizard** — step 1: textarea for idea, step 2: 5 dynamic questions (radio-cards), step 3: confirmation. Fade-in-up per question.
6. **Report page** — VerdictHeader (elevated + verdict glow), criteria breakdown, evidence, solutions, realization plan (paid) / LockedPlan (free). All sections separated by hairline dividers.
7. **Shared report** (`/r/[token]`) — same as report but no plan section, banner + CTA at bottom.
8. **Account** — user profile, plan, usage.
9. **Mini admin** — table views, paid toggle, LLM cost column. Inherits dark tokens.

## Tone of voice (report copy)

Honest, direct, evidence-first. Never hype ("This WILL succeed"), never vague ("might be interesting"). Pattern: claim → evidence → implication. Uncertainty stated explicitly. English only. **Design supports this:** restricted color palette & premium presentation say "this is serious research, not cheerleading."

## Notes

- **Email** (`send-report-ready.ts`) remains light — transactional email, not app UI. Dark emails render poorly across clients.
- **LockedPlan gating** is server-side. Plan column only SELECTed for paid users. Synthetic blurred placeholder ensures free users never see real plan text.
- **RLS regression:** privilege/billing columns (`role`, `plan`, `free_credit_used`) protected by column-level grants. Manual verification for MVP; automated test to come.
