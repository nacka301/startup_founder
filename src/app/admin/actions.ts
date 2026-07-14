"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export type PlanResult = { error: string } | { ok: true; plan: "free" | "paid" };

const setUserPlanSchema = z.object({
  userId: z.string().uuid(),
  plan: z.enum(["free", "paid"]),
});

/**
 * Manual paid toggle (PRD §7: "until billing ships, admin can toggle paid
 * manually"). `profiles.plan` is a server-only column (no authenticated UPDATE
 * grant — see 20260705193000_profiles_column_privileges.sql), so this writes
 * with the service-role client.
 *
 * SECURITY: requireAdmin() runs first and independently of the layout/page, so
 * a normal user replaying or hand-crafting this action is 404'd before any
 * write. Inputs are Zod-validated — the client UI is not trusted.
 */
export async function setUserPlan(
  userId: string,
  plan: "free" | "paid",
): Promise<PlanResult> {
  await requireAdmin();

  const parsed = setUserPlanSchema.safeParse({ userId, plan });
  if (!parsed.success) {
    return { error: "Invalid request." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ plan: parsed.data.plan })
    .eq("id", parsed.data.userId);

  if (error) {
    return { error: "Couldn't update the plan. Please try again." };
  }

  revalidatePath("/admin");
  return { ok: true, plan: parsed.data.plan };
}
