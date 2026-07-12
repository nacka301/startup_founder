import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";

/**
 * Magic-link callback. Supports both Supabase email-link flows so it works
 * regardless of how the project's magic-link template is configured:
 *   - PKCE:       `?code=...`               -> exchangeCodeForSession
 *   - token_hash: `?token_hash=...&type=..` -> verifyOtp (default template)
 * On success we send the user to a validated in-app path (safeNextPath guards
 * against open redirects).
 */

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // Pass a short, known code — the login page maps it to fixed copy so the URL
  // can't be used to inject arbitrary on-page text.
  return NextResponse.redirect(`${origin}/login?error=invalid_link`);
}
