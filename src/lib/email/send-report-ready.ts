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
 *
 * HTML is hand-written table-based markup (not the app's Tailwind/CSS-variable
 * system) — email clients (Outlook in particular) don't support flexbox, grid,
 * or modern CSS, so transactional email needs its own "bulletproof" layout.
 * Light background by design (UI-STYLE-GUIDE): dark email renders poorly
 * across clients, so brand color here is an accent, not the surface.
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

const VERDICT_COLOR: Record<"go" | "caution" | "stop", string> = {
  go: "#22C55E",
  caution: "#F59E0B",
  stop: "#EF4444",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Shared shell: logo header, card container, footer disclaimer. `bodyHtml` is
 * trusted markup built by the two variants below (never raw user input).
 */
function emailShell(previewText: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>BuildWorthy</title>
</head>
<body style="margin:0; padding:0; background-color:#FAFAF9; font-family:Inter,Arial,Helvetica,sans-serif;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
  ${escapeHtml(previewText)}
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAFAF9;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:100%; background-color:#FFFFFF; border:1px solid #E7E5E4; border-radius:12px; overflow:hidden;">
        <tr>
          <td style="padding:24px 32px; border-bottom:1px solid #F0EFED;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width:28px; height:28px; background-color:#6366F1; border-radius:8px; font-size:0; line-height:0;">&nbsp;</td>
                <td style="width:10px; font-size:0; line-height:0;">&nbsp;</td>
                <td style="font-size:17px; font-weight:700; color:#1C1917; letter-spacing:-0.02em;">BuildWorthy</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px; border-top:1px solid #F0EFED;">
            <p style="margin:0; font-size:12px; line-height:1.6; color:#A8A29E;">
              BuildWorthy &mdash; research assistance for your idea, not guaranteed business advice.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Bulletproof CTA button: table-based so it renders correctly in Outlook. */
function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="background-color:#6366F1; border-radius:10px;">
      <a href="${href}" style="display:inline-block; padding:12px 24px; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`;
}

function buildContent(params: ReportReadyParams): {
  subject: string;
  html: string;
  text: string;
} {
  const url = absoluteUrl(`/analyses/${params.analysisId}`);

  if (params.status === "done") {
    const color = VERDICT_COLOR[params.verdict];
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

    const body = `
      <h1 style="margin:0 0 20px; font-size:24px; font-weight:700; color:#1C1917; letter-spacing:-0.02em;">
        Your verdict is ready
      </h1>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
        <tr>
          <td style="font-size:28px; font-weight:700; color:#1C1917; letter-spacing:-0.02em;">
            ${params.score}<span style="font-size:16px; font-weight:500; color:#A8A29E;">/100</span>
          </td>
          <td style="width:12px; font-size:0; line-height:0;">&nbsp;</td>
          <td>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:${color}1a; border-radius:999px; padding:5px 14px;">
                  <span style="font-size:13px; font-weight:700; letter-spacing:0.04em; color:${color};">
                    ${VERDICT_WORD[params.verdict]}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 28px; font-size:15px; line-height:1.65; color:#44403C;">
        ${escapeHtml(params.summary)}
      </p>
      ${ctaButton(url, "View your full report")}
      <p style="margin:20px 0 0; font-size:13px; line-height:1.5; color:#78716C;">
        The full report includes the criteria breakdown, evidence with sources, and a suggested MVP shape.
      </p>`;

    return {
      subject,
      html: emailShell(`Your idea scored ${params.score}/100 — ${VERDICT_WORD[params.verdict]}`, body),
      text,
    };
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

  const body = `
    <h1 style="margin:0 0 16px; font-size:24px; font-weight:700; color:#1C1917; letter-spacing:-0.02em;">
      We couldn't reach a verdict yet
    </h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.65; color:#44403C;">
      ${escapeHtml(params.summary)}
    </p>
    <p style="margin:0 0 28px; font-size:15px; line-height:1.65; color:#1C1917;">
      <strong>Your free analysis hasn't been used.</strong> Sharpen the idea and try again &mdash; it won't cost you a credit.
    </p>
    ${ctaButton(url, "See what to try next")}`;

  return {
    subject,
    html: emailShell("We couldn't find enough evidence for a verdict — your free analysis is still available", body),
    text,
  };
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
