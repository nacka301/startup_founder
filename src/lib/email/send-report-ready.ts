import "server-only";
import { absoluteUrl } from "@/lib/site";

/**
 * "Your verdict is ready" transactional email (ARCHITECTURE.md Stage E), sent via
 * the Resend REST API with `fetch` — no SDK dependency. English copy only.
 *
 * Two variants: a finished verdict (score + summary + link) and the
 * insufficient-evidence outcome (why, plus that the free credit was not used).
 * This function returns a result and never throws — the caller in the analysis
 * job must treat email as a best-effort side-effect that cannot fail the run.
 */

type ReportReadyParams =
  | {
      to: string;
      analysisId: string;
      status: "done";
      score: number;
      verdict: "go" | "caution" | "stop";
      summary: string;
    }
  | {
      to: string;
      analysisId: string;
      status: "insufficient_evidence";
      summary: string;
    };

type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

const VERDICT_WORD: Record<"go" | "caution" | "stop", string> = {
  go: "GO",
  caution: "CAUTION",
  stop: "STOP",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildContent(params: ReportReadyParams): {
  subject: string;
  html: string;
  text: string;
} {
  const url = absoluteUrl(`/analyses/${params.analysisId}`);

  if (params.status === "done") {
    const subject = `Your verdict is ready — ${params.score}/100 (${VERDICT_WORD[params.verdict]})`;
    const text = [
      `Your idea analysis is ready.`,
      ``,
      `Score: ${params.score}/100 — ${VERDICT_WORD[params.verdict]}`,
      ``,
      params.summary,
      ``,
      `See the full report, evidence, and MVP shape:`,
      url,
    ].join("\n");
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;color:#1C1917;max-width:520px;margin:0 auto;">
        <h1 style="font-size:20px;margin:0 0 12px;">Your verdict is ready</h1>
        <p style="font-size:15px;margin:0 0 8px;">
          <strong>${params.score}/100 — ${VERDICT_WORD[params.verdict]}</strong>
        </p>
        <p style="font-size:15px;line-height:1.6;color:#44403C;margin:0 0 20px;">
          ${escapeHtml(params.summary)}
        </p>
        <a href="${url}" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:10px 18px;border-radius:10px;">
          View your full report
        </a>
        <p style="font-size:13px;color:#78716C;margin:20px 0 0;">
          The full report includes the criteria breakdown, evidence with sources, and a suggested MVP shape.
        </p>
      </div>`;
    return { subject, html, text };
  }

  const subject = "We couldn't reach a verdict yet — your free analysis is safe";
  const text = [
    `We looked into your idea but couldn't find enough public evidence to give a verdict you can trust.`,
    ``,
    params.summary,
    ``,
    `Your free analysis has NOT been used — you can sharpen the idea and try again:`,
    url,
  ].join("\n");
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#1C1917;max-width:520px;margin:0 auto;">
      <h1 style="font-size:20px;margin:0 0 12px;">We couldn't reach a verdict yet</h1>
      <p style="font-size:15px;line-height:1.6;color:#44403C;margin:0 0 12px;">
        ${escapeHtml(params.summary)}
      </p>
      <p style="font-size:15px;line-height:1.6;color:#1C1917;margin:0 0 20px;">
        <strong>Your free analysis hasn't been used.</strong> Sharpen the idea and try again — it won't cost you a credit.
      </p>
      <a href="${url}" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:10px 18px;border-radius:10px;">
        See what to try next
      </a>
    </div>`;
  return { subject, html, text };
}

export async function sendReportReadyEmail(
  params: ReportReadyParams,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return {
      ok: false,
      error: "RESEND_API_KEY or RESEND_FROM_EMAIL is not configured",
    };
  }

  const { subject, html, text } = buildContent(params);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: params.to, subject, html, text }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 200)}` };
    }

    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "email send failed" };
  }
}
