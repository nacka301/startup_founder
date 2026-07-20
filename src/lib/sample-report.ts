import type {
  ConfidenceLevel,
  EvidenceItem,
  ReportCriterion,
  ReportPlan,
  ReportSolutions,
} from "@/lib/report-schema";

/**
 * Static demo report for the public `/sample` route (linked from the landing
 * "See a sample report" / "Preview the full report" CTAs). Content mirrors the
 * v2 prototype's worked example (invoice-chasing tool for freelancers) and is
 * shaped to the real report schemas so it renders through the same ReportView
 * as a live report. Not persisted, not generated — purely illustrative.
 */

export const SAMPLE_IDEA =
  "A tool that reminds freelancers to chase overdue invoices and drafts the follow-up email for them.";

export const SAMPLE_SCORE = 78;
export const SAMPLE_VERDICT = "go" as const;
export const SAMPLE_CONFIDENCE: ConfidenceLevel = "high";

export const SAMPLE_SUMMARY =
  "A real, frequently-voiced problem with clear willingness to pay. Competition exists but leaves obvious gaps, and it fits a solo builder's time and budget. The evidence supports building a focused first version.";

export const SAMPLE_CRITERIA: ReportCriterion[] = [
  {
    key: "problem_severity",
    score: 82,
    reasoning:
      "Freelancers describe chasing overdue invoices as a recurring monthly drain — emotionally awkward and time-consuming. The complaint is specific, frequent, and voiced with clear frustration.",
    evidence_ids: ["e1", "e2"],
  },
  {
    key: "competition",
    score: 71,
    reasoning:
      "Accounting suites offer reminders, but they're buried and generic. No lightweight, freelancer-first tool owns “get me paid without the awkward chase.” A real gap, though incumbents could copy it.",
    evidence_ids: ["e5"],
  },
  {
    key: "personal_feasibility",
    score: 78,
    reasoning:
      "Fits a solo builder with coding skills and 15–30h/week. The MVP is a narrow automation — achievable within a modest budget and timeline.",
    evidence_ids: [],
  },
  {
    key: "monetization",
    score: 68,
    reasoning:
      "Willingness to pay is explicit in the evidence, but freelancers are price-sensitive. A low monthly price works; expansion revenue is limited without moving upmarket to agencies.",
    evidence_ids: ["e3"],
  },
];

export const SAMPLE_EVIDENCE: EvidenceItem[] = [
  {
    id: "e1",
    source: "reddit.com/r/freelance",
    url: "https://www.reddit.com/r/freelance/",
    quote:
      "I waste half a day every month chasing clients for invoices they 'forgot'. I'd genuinely pay for something that just did it for me.",
    author_handle: null,
    severity: 3,
    topic: "Chasing late payments",
    similar_count: 34,
  },
  {
    id: "e2",
    source: "reddit.com/r/graphic_design",
    url: "https://www.reddit.com/r/graphic_design/",
    quote:
      "The worst part of freelancing isn't the work, it's the awkward 'hey, just following up on that invoice' email for the third time.",
    author_handle: null,
    severity: 2,
    topic: "Chasing late payments",
    similar_count: 21,
  },
  {
    id: "e3",
    source: "indiehackers.com",
    url: "https://www.indiehackers.com/",
    quote:
      "Take my money. If a tool sent polite reminders automatically and got me paid a week faster, that pays for itself instantly.",
    author_handle: null,
    severity: 3,
    topic: "Willingness to pay",
    similar_count: 18,
  },
  {
    id: "e4",
    source: "reddit.com/r/smallbusiness",
    url: "https://www.reddit.com/r/smallbusiness/",
    quote:
      "Currently doing this manually with calendar reminders and it's a mess. Would switch to anything that just handled it.",
    author_handle: null,
    severity: 2,
    topic: "Willingness to pay",
    similar_count: 12,
  },
  {
    id: "e5",
    source: "reddit.com/r/Accounting",
    url: "https://www.reddit.com/r/Accounting/",
    quote:
      "QuickBooks technically has reminders but they're so generic clients ignore them. I turned them off.",
    author_handle: null,
    severity: 3,
    topic: "Existing tools fall short",
    similar_count: 6,
  },
];

export const SAMPLE_SOLUTIONS: ReportSolutions = {
  mvp_sketch:
    "A lightweight tool that connects to Stripe or QuickBooks, watches for invoices past their due date, and — with one click — sends a friendly, pre-drafted follow-up on the freelancer's behalf. No dashboard to learn; it works from email.",
  possible_solutions: [
    "Lean into tone: reminders that sound like the freelancer wrote them, not a robot — that's the emotional wedge.",
    "Start Stripe-only for the fastest integration, add QuickBooks once the loop is proven.",
    "A “get paid faster” framing sells better than “invoice management” — outcome over category.",
  ],
};

export const SAMPLE_PLAN: ReportPlan = {
  mvp: "One connected account (Stripe), one automation (detect overdue → draft reminder), one action (approve & send). Ship that loop to 10 freelancers before adding anything else.",
  weekly_steps: [
    {
      week: 1,
      focus: "Shape the smallest useful version",
      tasks: [
        "Connect one Stripe account and read overdue invoices",
        "Write 3 reminder tones (friendly, firm, final)",
        "Define the single 'approve & send' action",
      ],
    },
    {
      week: 2,
      focus: "Build the core loop end to end",
      tasks: [
        "Detect overdue → draft reminder → one-click send",
        "Log what was sent and when it was paid",
        "Basic email digest of what needs attention",
      ],
    },
    {
      week: 3,
      focus: "Put it in front of ten real freelancers",
      tasks: [
        "Recruit 10 from r/freelance and Discord",
        "Watch them use it; note every point of friction",
      ],
    },
    {
      week: 4,
      focus: "Tighten, price, and launch",
      tasks: [
        "Fix the top 3 friction points",
        "Set a simple monthly price and add checkout",
        "Ship a Show IH / Reddit launch post",
      ],
    },
  ],
  tools: [
    { name: "Stripe", purpose: "invoice data + payment status, the source of truth" },
    { name: "Next.js + Vercel", purpose: "app and hosting with zero-ops deploys" },
    { name: "Resend", purpose: "sending the reminder emails reliably" },
    { name: "Supabase", purpose: "auth and storing sent-reminder history" },
  ],
  marketing: {
    first_customers: [
      "r/freelance, r/smallbusiness",
      "Freelancer Discords & Slack groups",
      "Indie Hackers",
    ],
    channels: [
      "A 'get paid faster' Show IH post",
      "DM 20 freelancers who complained",
      "Partner with a freelance newsletter",
    ],
  },
};
