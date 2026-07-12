"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { tasks } from "@trigger.dev/sdk";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { STUCK_AFTER_MS } from "@/lib/analyses";
import type { runAnalysis } from "@/trigger/run-analysis";

type Answer = { id: string; answer: string };
type SubmitResult = { error: string };

export type ShareResult =
  | { error: string }
  | { ok: true; shareEnabled: boolean; shareToken: string | null };

/**
 * Step 2 → 3: store the 5 answers and move the analysis to 'queued', then
 * redirect back to the analysis page (which now shows the confirmation). Answers
 * are validated against each question's stored options; ownership is enforced by
 * loading the analysis through the user's RLS-scoped session before writing with
 * the service client.
 */
export async function submitAnswers(
  analysisId: string,
  answers: Answer[],
): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired. Please sign in again." };
  }

  // RLS scopes this to the owner; a non-owner (or missing id) gets null.
  const { data: analysis } = await supabase
    .from("analyses")
    .select("id, status")
    .eq("id", analysisId)
    .maybeSingle();

  if (!analysis) {
    return { error: "We couldn't find that analysis." };
  }
  if (analysis.status !== "clarifying") {
    return { error: "This analysis has already been submitted." };
  }

  const { data: questions } = await supabase
    .from("analysis_questions")
    .select("id, options")
    .eq("analysis_id", analysisId);

  if (!questions || questions.length === 0) {
    return { error: "Something went wrong. Please try again." };
  }

  // Validate: exactly one answer per question, each ∈ that question's options.
  // Count + membership + no-duplicates together guarantee full unique coverage
  // (N distinct valid question ids out of N questions ⇒ every question answered).
  const optionsById = new Map(
    questions.map((q) => [q.id as string, (q.options as string[]) ?? []]),
  );
  if (answers.length !== questions.length) {
    return { error: "Please answer every question." };
  }
  const seen = new Set<string>();
  for (const a of answers) {
    const options = optionsById.get(a.id);
    if (!options) {
      return { error: "Something went wrong. Please try again." };
    }
    if (seen.has(a.id)) {
      return { error: "Please answer every question." };
    }
    seen.add(a.id);
    if (!options.includes(a.answer)) {
      return { error: "Please choose one of the suggested answers." };
    }
  }

  const service = createServiceClient();

  for (const a of answers) {
    const { error } = await service
      .from("analysis_questions")
      .update({ answer: a.answer })
      .eq("id", a.id)
      .eq("analysis_id", analysisId);
    if (error) {
      return { error: "Couldn't save your answers. Please try again." };
    }
  }

  // Guard on status = 'clarifying' so a double-submit can't re-queue. Selecting
  // the affected row confirms *this* call performed the transition (0 rows means
  // a concurrent submit already queued it) — so we don't enqueue the job twice.
  const { data: queued, error: statusError } = await service
    .from("analyses")
    .update({ status: "queued" })
    .eq("id", analysisId)
    .eq("status", "clarifying")
    .select("id");

  if (statusError || !queued || queued.length === 0) {
    return { error: "Couldn't submit your analysis. Please try again." };
  }

  // Enqueue the evidence-gathering job (Stage B). The task itself moves the
  // status queued → running. Store the run id for the mini admin / debugging.
  //
  // The idempotency key is stable per analysis, so a retry after a timed-out
  // (but actually registered) trigger call resolves to the same run instead of
  // starting a second one — this is what makes it safe to retry a few times
  // in-process before giving up and rolling back.
  const ENQUEUE_ATTEMPTS = 3;
  let handle: Awaited<ReturnType<typeof tasks.trigger<typeof runAnalysis>>> | null =
    null;
  let lastError: unknown;
  for (let attempt = 0; attempt < ENQUEUE_ATTEMPTS; attempt++) {
    try {
      handle = await tasks.trigger<typeof runAnalysis>(
        "run-analysis",
        { analysisId },
        { idempotencyKey: analysisId, idempotencyKeyTTL: "1h" },
      );
      break;
    } catch (e) {
      lastError = e;
      if (attempt < ENQUEUE_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  }

  if (!handle) {
    console.error(
      "Failed to enqueue analysis job:",
      lastError instanceof Error ? lastError.message : lastError,
    );
    // Roll back to 'clarifying' so the user can resubmit — their answers stay
    // saved, and the guarded status update keeps this safe against a race.
    // Every attempt above threw, so nothing was registered with Trigger.dev
    // under this idempotency key — there's no run to strand.
    await service
      .from("analyses")
      .update({ status: "clarifying" })
      .eq("id", analysisId)
      .eq("status", "queued");
    return { error: "We couldn't start your analysis. Please try again." };
  }

  await service
    .from("analyses")
    .update({ trigger_run_id: handle.id })
    .eq("id", analysisId);

  redirect(`/analyses/${analysisId}`);
}

/**
 * Discard an in-progress analysis so the user can start over. Ownership is
 * enforced by loading the row through the user's RLS-scoped session before any
 * service-role write. Two cases:
 *
 *   - 'clarifying'        → delete the row (cascades to its questions; llm_costs
 *                           rows survive via analysis_id set null). The job hasn't
 *                           started, so nothing else owns its lifecycle.
 *   - 'queued'/'running'  → ONLY when the row has been untouched for STUCK_AFTER_MS
 *                           (far past the job's maxDuration): mark it 'failed' with
 *                           code 'cancelled'. This is the escape hatch for a run
 *                           that was enqueued but never executed, or killed by
 *                           maxDuration without onFailure — otherwise the user is
 *                           trapped (can't start a new one, active-slot gate).
 *
 * Marking 'failed' (rather than deleting) is safe against a late worker pickup: the
 * job no-ops at its top-of-run status guard when the row isn't queued/running, so a
 * stray run can never consume the credit. The staleness window rules out racing a
 * healthy in-flight run. Redirects to the new-analysis page on success.
 */
export async function cancelAnalysis(analysisId: string): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired. Please sign in again." };
  }

  // RLS scopes this to the owner; a non-owner (or missing id) gets null.
  const { data: analysis } = await supabase
    .from("analyses")
    .select("id, status, updated_at")
    .eq("id", analysisId)
    .maybeSingle();

  if (!analysis) {
    return { error: "We couldn't find that analysis." };
  }

  const service = createServiceClient();

  if (analysis.status === "clarifying") {
    // Guard on status so a concurrent submit can't have it deleted out from
    // under a job that's just been queued.
    const { error } = await service
      .from("analyses")
      .delete()
      .eq("id", analysisId)
      .eq("status", "clarifying");

    if (error) {
      return { error: "Couldn't discard this analysis. Please try again." };
    }

    redirect("/analyses/new");
  }

  if (analysis.status === "queued" || analysis.status === "running") {
    const stale =
      Date.now() - new Date(analysis.updated_at as string).getTime() >
      STUCK_AFTER_MS;
    if (!stale) {
      return {
        error:
          "This analysis is still running. Give it a few more minutes — we'll email you when it's ready.",
      };
    }

    // Guarded on queued/running so we never clobber a row that just settled to
    // done/insufficient_evidence in a race.
    const { error } = await service
      .from("analyses")
      .update({ status: "failed", failure_code: "cancelled" })
      .eq("id", analysisId)
      .in("status", ["queued", "running"]);

    if (error) {
      return { error: "Couldn't discard this analysis. Please try again." };
    }

    redirect("/analyses/new");
  }

  return { error: "This analysis is already finished and can't be discarded." };
}

/**
 * Opt-in public sharing (PRD §5.7). Enabling flips `share_enabled` and mints a
 * `share_token` (once, reused on re-enable) so `/r/[token]` can render the report
 * without auth; disabling flips it back (the token is kept but the route ignores
 * a disabled share). Ownership is enforced via the user's RLS-scoped session
 * before any service-role write, and only a finished analysis (done /
 * insufficient_evidence) can be shared. Never touches role/plan/credit columns.
 */
export async function setShareEnabled(
  analysisId: string,
  enabled: boolean,
): Promise<ShareResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired. Please sign in again." };
  }

  // RLS scopes this to the owner; a non-owner (or missing id) gets null.
  const { data: analysis } = await supabase
    .from("analyses")
    .select("id, status, share_enabled, share_token")
    .eq("id", analysisId)
    .maybeSingle();

  if (!analysis) {
    return { error: "We couldn't find that analysis." };
  }
  if (
    analysis.status !== "done" &&
    analysis.status !== "insufficient_evidence"
  ) {
    return { error: "You can only share a finished analysis." };
  }

  const currentToken = (analysis.share_token as string | null) ?? null;
  const nextToken =
    enabled && !currentToken ? crypto.randomUUID() : currentToken;

  // Scope the write to the owner as defense-in-depth on top of the RLS read.
  const service = createServiceClient();
  const { error } = await service
    .from("analyses")
    .update({ share_enabled: enabled, share_token: nextToken })
    .eq("id", analysisId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "Couldn't update sharing. Please try again." };
  }

  revalidatePath(`/analyses/${analysisId}`);
  return { ok: true, shareEnabled: enabled, shareToken: nextToken };
}
