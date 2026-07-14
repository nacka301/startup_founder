"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { verifyCode } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// v2 editorial auth tokens (indigo app-flow accent, kept distinct from the
// cyan marketing CTA). Shared between the email and code steps.
const labelClass =
  "font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]";
// text-[15px] is doubled with md:text-[15px] so it also overrides the base
// Input's `md:text-sm` (which would otherwise win at ≥md and shrink the field).
const inputClass =
  "h-auto rounded-[12px] border-input bg-card px-4 py-3.5 text-[15px] md:text-[15px]";
const submitClass = "h-12 w-full rounded-[12px] text-[15px]";

type SendStatus = "idle" | "sending" | "sent" | "error";
type VerifyStatus = "idle" | "verifying" | "error";

// Fixed copy for error codes handed back by /auth/callback. We never render the
// raw query param, so the URL can't be used to inject arbitrary on-page text.
const ERROR_MESSAGES: Record<string, string> = {
  invalid_link:
    "That magic link is invalid or has expired. Request a new one below, or enter the 6-digit code from the email.",
};

function messageForErrorCode(code: string): string {
  return ERROR_MESSAGES[code] ?? "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle");
  const [sendError, setSendError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Post-login destination, set by middleware when it bounces a protected route
  // (e.g. ?next=/analyses/new). Validated server-side before any redirect.
  const [next, setNext] = useState<string | null>(null);

  // Surface errors handed back by the /auth/callback route (e.g. consumed link),
  // and pick up the intended post-login destination.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    if (code) setSendError(messageForErrorCode(code));
    setNext(params.get("next"));
  }, []);

  async function sendMagicLink() {
    setSendStatus("sending");
    setSendError(null);
    setVerifyError(null);

    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (next) callbackUrl.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      // A failed SMTP send surfaces as a 500 with an unhelpful body ("{}"), so
      // fall back to friendly copy and keep the raw error in the dev console.
      if (process.env.NODE_ENV !== "production") {
        console.error("signInWithOtp failed:", error);
      }
      const useful = error.message && error.message !== "{}";
      setSendError(
        useful
          ? error.message
          : "We couldn't send the email. Please try again in a moment.",
      );
      setSendStatus("error");
    } else {
      setSendStatus("sent");
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    await sendMagicLink();
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyStatus("verifying");
    setVerifyError(null);

    // Verified server-side (see ./actions) so auth cookies are set before we
    // navigate; on success the action redirects and this returns nothing.
    const result = await verifyCode(email, code, next);
    if (result?.error) {
      setVerifyError(result.error);
      setVerifyStatus("error");
    }
  }

  function reset() {
    setSendStatus("idle");
    setSendError(null);
    setCode("");
    setVerifyStatus("idle");
    setVerifyError(null);
  }

  return (
    <main className="animate-fade-in-up mx-auto w-full max-w-[400px] px-6 pt-16 pb-[140px]">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back
      </Link>

      <div className="mb-7 flex items-center gap-2.5">
        <span
          aria-hidden
          className="size-[26px] shrink-0 rounded-lg"
          style={{
            background: "linear-gradient(135deg,#22D3EE,#A78BFA)",
            boxShadow: "0 0 18px rgba(34,211,238,0.45)",
          }}
        />
        <span className="text-[17px] font-semibold tracking-[-0.02em]">
          BuildWorthy
        </span>
      </div>

      {sendStatus === "sent" ? (
        <div>
          <span
            aria-hidden
            className="mb-5 flex size-12 items-center justify-center rounded-[12px] text-[#A5B4FC]"
            style={{ backgroundColor: "rgba(99,102,241,0.14)" }}
          >
            <Mail className="size-[22px]" />
          </span>
          <h1 className="mb-2.5 text-[28px] font-semibold tracking-[-0.025em]">
            Check your email
          </h1>
          <p className="mb-6 text-[15px] leading-[1.6] text-muted-foreground">
            We sent a magic link and a 6-digit code to{" "}
            <span className="text-foreground">{email}</span>. Click the link, or
            enter the code below.
          </p>

          <form onSubmit={handleVerify} className="flex flex-col gap-2">
            <Label htmlFor="code" className={labelClass}>
              6-digit code
            </Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              aria-invalid={verifyError ? true : undefined}
              aria-describedby={verifyError ? "code-error" : undefined}
              className={`${inputClass} text-center font-mono text-[22px] font-semibold tracking-[0.4em] md:text-[22px]`}
            />
            {verifyError && (
              <p
                id="code-error"
                role="alert"
                aria-live="polite"
                className="text-sm text-destructive"
              >
                {verifyError}
              </p>
            )}
            <Button
              type="submit"
              className={`mt-3 ${submitClass}`}
              disabled={code.length !== 6 || verifyStatus === "verifying"}
            >
              {verifyStatus === "verifying" ? "Verifying…" : "Continue"}
              {verifyStatus !== "verifying" && (
                <ArrowRight className="size-4" aria-hidden />
              )}
            </Button>
          </form>

          <div className="mt-[18px] flex justify-center gap-4 text-[13px]">
            <button
              type="button"
              onClick={reset}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Use a different email
            </button>
            <span className="text-[#374151]">·</span>
            <button
              type="button"
              onClick={sendMagicLink}
              className="text-primary transition-colors hover:text-[#A5B4FC]"
            >
              Resend code
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="mb-2.5 text-[28px] font-semibold tracking-[-0.025em]">
            Sign in or create your account
          </h1>
          <p className="mb-6 text-[15px] leading-[1.6] text-muted-foreground">
            Enter your email and we&apos;ll send you a magic link and a 6-digit
            code. No password to remember.
          </p>

          <form onSubmit={handleSend} className="flex flex-col gap-2">
            <Label htmlFor="email" className={labelClass}>
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={sendError ? true : undefined}
              aria-describedby={sendError ? "login-error" : undefined}
              className={inputClass}
            />
            {sendError && (
              <p
                id="login-error"
                role="alert"
                aria-live="polite"
                className="text-sm text-destructive"
              >
                {sendError}
              </p>
            )}
            <Button
              type="submit"
              variant="gradient"
              className={`mt-3 ${submitClass}`}
              disabled={sendStatus === "sending"}
            >
              {sendStatus === "sending" ? "Sending…" : "Send my magic link"}
              {sendStatus !== "sending" && (
                <ArrowRight className="size-4" aria-hidden />
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-[12.5px] leading-[1.5] text-muted-foreground">
            Research assistance for your idea — not guaranteed business advice.
          </p>
        </div>
      )}
    </main>
  );
}
