"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { verifyCode } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

  // Surface errors handed back by the /auth/callback route (e.g. consumed link).
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setSendError(messageForErrorCode(code));
  }, []);

  async function sendMagicLink() {
    setSendStatus("sending");
    setSendError(null);
    setVerifyError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
    const result = await verifyCode(email, code);
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
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="shadow-elevated w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to BuildWorthy</CardTitle>
          <CardDescription>
            {sendStatus === "sent"
              ? "We sent you a sign-in link and a 6-digit code."
              : "Enter your email and we'll send you a magic link and a code — no password needed."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sendStatus === "sent" ? (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-muted-foreground">
                Check your inbox for{" "}
                <span className="font-medium text-foreground">{email}</span>.
                Click the link, or enter the 6-digit code below — whichever
                works.
              </p>

              <form onSubmit={handleVerify} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code">6-digit code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    aria-invalid={verifyError ? true : undefined}
                    aria-describedby={verifyError ? "code-error" : undefined}
                  />
                </div>
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
                  disabled={code.length !== 6 || verifyStatus === "verifying"}
                >
                  {verifyStatus === "verifying" ? "Verifying…" : "Verify code"}
                </Button>
              </form>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={sendMagicLink}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Resend email
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
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
                />
              </div>
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
              <Button type="submit" disabled={sendStatus === "sending"}>
                {sendStatus === "sending" ? "Sending…" : "Send magic link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
