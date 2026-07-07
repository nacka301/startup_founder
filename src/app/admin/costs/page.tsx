import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

/** USD, 4 decimals to match llm_costs.cost_usd numeric(8,4). */
function usd(n: number): string {
  return `$${n.toFixed(4)}`;
}

type CostRow = {
  analysis_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string | number; // numeric arrives as string via supabase-js
};

/**
 * LLM spend view (PRD §4, §11: "Log cost per analysis from day 1"). llm_costs is
 * admin-only at the RLS layer. Aggregated in JS (no GROUP BY needed at MVP
 * scale): totals, per model (Haiku / Sonnet / other), and per analysis.
 */
export default async function AdminCostsPage() {
  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("llm_costs")
    .select("analysis_id, model, input_tokens, output_tokens, cost_usd");
  const rows = (data ?? []) as CostRow[];

  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;

  const byModel = new Map<
    string,
    { cost: number; input: number; output: number; calls: number }
  >();
  const byAnalysis = new Map<string, { cost: number; calls: number }>();

  for (const r of rows) {
    const cost = Number(r.cost_usd) || 0;
    const input = r.input_tokens ?? 0;
    const output = r.output_tokens ?? 0;

    totalCost += cost;
    totalInput += input;
    totalOutput += output;

    const m = byModel.get(r.model) ?? { cost: 0, input: 0, output: 0, calls: 0 };
    m.cost += cost;
    m.input += input;
    m.output += output;
    m.calls += 1;
    byModel.set(r.model, m);

    const key = r.analysis_id ?? "__unattributed__";
    const a = byAnalysis.get(key) ?? { cost: 0, calls: 0 };
    a.cost += cost;
    a.calls += 1;
    byAnalysis.set(key, a);
  }

  const modelRows = [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const analysisRows = [...byAnalysis.entries()].sort(
    (a, b) => b[1].cost - a[1].cost,
  );

  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-xl font-semibold tracking-tight">LLM spend</h2>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total spend" value={usd(totalCost)} />
        <Stat label="LLM calls" value={String(rows.length)} />
        <Stat label="Input tokens" value={totalInput.toLocaleString("en-US")} />
        <Stat label="Output tokens" value={totalOutput.toLocaleString("en-US")} />
      </div>

      {/* Per model */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[15px] font-medium text-foreground">By model</h3>
        {modelRows.length === 0 ? (
          <p className="text-muted-foreground">No spend recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-[13px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Calls</th>
                  <th className="px-4 py-3 font-medium">Input tokens</th>
                  <th className="px-4 py-3 font-medium">Output tokens</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {modelRows.map(([model, m]) => (
                  <tr
                    key={model}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-[13px] text-foreground">
                      {model}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.calls}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.input.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.output.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-foreground">{usd(m.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Per analysis */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[15px] font-medium text-foreground">By analysis</h3>
        {analysisRows.length === 0 ? (
          <p className="text-muted-foreground">No spend recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-[13px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Analysis</th>
                  <th className="px-4 py-3 font-medium">Calls</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {analysisRows.map(([key, a]) => (
                  <tr key={key} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      {key === "__unattributed__" ? (
                        <span className="text-muted-foreground">
                          unattributed
                        </span>
                      ) : (
                        <Link
                          href={`/analyses/${key}`}
                          className="font-mono text-[13px] text-primary hover:underline"
                        >
                          {key.slice(0, 8)}…
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.calls}</td>
                    <td className="px-4 py-3 text-foreground">{usd(a.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}
