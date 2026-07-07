import Link from "next/link";
import { requireAdmin, getUserEmails } from "@/lib/admin";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_META, type AnalysisStatus } from "@/lib/analyses";

const STATUSES = Object.keys(STATUS_META) as AnalysisStatus[];

function isStatus(value: string | undefined): value is AnalysisStatus {
  return !!value && (STATUSES as string[]).includes(value);
}

/** One embedded report row from the analyses ↔ reports one-to-one relation. */
type EmbeddedReport = { score: number | null; verdict: string | null };
function reportOf(reports: unknown): EmbeddedReport | null {
  if (Array.isArray(reports)) return (reports[0] as EmbeddedReport) ?? null;
  return (reports as EmbeddedReport) ?? null;
}

/**
 * Analyses list (PRD §4) with a status filter. Admin reads all rows via the
 * is_admin() RLS policy; the report score/verdict is embedded through the
 * analyses ↔ reports FK. Each row links to its /analyses/[id] report.
 */
export default async function AdminAnalysesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { status } = await searchParams;
  const activeStatus = isStatus(status) ? status : null;

  let query = supabase
    .from("analyses")
    .select(
      "id, user_id, status, consumed_credit, created_at, reports(score, verdict)",
    )
    .order("created_at", { ascending: false });
  if (activeStatus) {
    query = query.eq("status", activeStatus);
  }

  const { data: analyses } = await query;
  const emails = await getUserEmails();
  const list = analyses ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">
        Analyses
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {list.length}
        </span>
      </h2>

      {/* Status filter — server-side via searchParams, no client component. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip label="All" href="/admin/analyses" active={!activeStatus} />
        {STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={STATUS_META[s].label}
            href={`/admin/analyses?status=${s}`}
            active={activeStatus === s}
          />
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-muted-foreground">No analyses match this filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-[13px] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Analysis</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Credit</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Verdict</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const meta = STATUS_META[a.status as AnalysisStatus];
                const report = a.status === "done" ? reportOf(a.reports) : null;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-border align-middle last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/analyses/${a.id}`}
                        className="font-mono text-[13px] text-primary hover:underline"
                      >
                        {String(a.id).slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {emails.get(a.user_id as string) ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {meta ? (
                        <Badge variant={meta.badge}>{meta.label}</Badge>
                      ) : (
                        <span className="text-muted-foreground">{a.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.consumed_credit ? "consumed" : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {report?.score ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {report?.verdict ? (
                        <span className="uppercase">{report.verdict}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {String(a.created_at).slice(0, 10)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-[13px] transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted/50",
      )}
    >
      {label}
    </Link>
  );
}
