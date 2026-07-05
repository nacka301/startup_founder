"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

type Status = "idle" | "loading" | "sent" | "error";

// Fixed copy for error codes handed back by /auth/callback. We never render the
// raw query param, so the URL can't be used to inject arbitrary on-page text.
const ERROR_MESSAGES: Record<string, string> = {
  invalid_link:
    "That magic link is invalid or has expired. Please request a new one.",
};

function messageForErrorCode(code: string): string {
  return ERROR_MESSAGES[code] ?? "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Surface errors handed back by the /auth/callback route (e.g. expired link).
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setError(messageForErrorCode(code));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAF9] p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to IdeaVerdict</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a magic link — no password needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "sent" ? (
            <p className="text-sm text-muted-foreground">
              Check your inbox for{" "}
              <span className="font-medium text-foreground">{email}</span> and click the
              link to sign in. You can close this tab.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>
              {error && (
                <p
                  id="login-error"
                  role="alert"
                  aria-live="polite"
                  className="text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <Button type="submit" disabled={status === "loading"}>
                {status === "loading" ? "Sending…" : "Send magic link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
