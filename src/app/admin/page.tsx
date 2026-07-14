import { requireAdmin, getUserEmails } from "@/lib/admin";
import { Badge } from "@/components/ui/badge";
import { PlanToggle } from "./plan-toggle";

/**
 * Users list (PRD §4). All reads go through the admin's RLS-scoped session
 * (is_admin() policy grants admins every row); emails come from the service
 * admin API. The plan cell flips via an admin-only server action.
 */
export default async function AdminUsersPage() {
  const { supabase } = await requireAdmin();

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, role, plan, free_credit_used, occupation, weekly_hours, budget_range, work_preference, created_at",
    )
    .order("created_at", { ascending: false });

  // Count analyses per user in one query (admin sees all rows via RLS).
  const { data: analysisRows } = await supabase.from("analyses").select("user_id");
  const analysisCounts = new Map<string, number>();
  for (const row of analysisRows ?? []) {
    const uid = row.user_id as string;
    analysisCounts.set(uid, (analysisCounts.get(uid) ?? 0) + 1);
  }

  const emails = await getUserEmails();
  const list = profiles ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">
        Users
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {list.length}
        </span>
      </h2>

      {list.length === 0 ? (
        <p className="text-muted-foreground">No users yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-[13px] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Free credit</th>
                <th className="px-4 py-3 font-medium">Occupation</th>
                <th className="px-4 py-3 font-medium">Hours/wk</th>
                <th className="px-4 py-3 font-medium">Budget</th>
                <th className="px-4 py-3 font-medium">Work pref</th>
                <th className="px-4 py-3 font-medium">Analyses</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Plan</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const plan = (u.plan === "paid" ? "paid" : "free") as
                  | "free"
                  | "paid";
                const email = emails.get(u.id) ?? "—";
                return (
                  <tr
                    key={u.id}
                    className="border-b border-border last:border-0 align-middle"
                  >
                    <td className="px-4 py-3 text-foreground">{email}</td>
                    <td className="px-4 py-3">
                      {u.role === "admin" ? (
                        <Badge variant="default">admin</Badge>
                      ) : (
                        <span className="text-muted-foreground">user</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={plan === "paid" ? "default" : "secondary"}>
                        {plan}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.free_credit_used ? "used" : "unused"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.occupation ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.weekly_hours ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.budget_range ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.work_preference ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {analysisCounts.get(u.id) ?? 0}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {String(u.created_at).slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <PlanToggle
                        userId={u.id}
                        email={email}
                        currentPlan={plan}
                      />
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
