"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";

type VerifyResult = { error: string };

/**
 * Verify the 6-digit email OTP server-side so the auth cookies are committed by
 * the server before we navigate (a client-side verify races the cookie write,
 * which bounced users back to /login). Uses the anon-key server client — never
 * the service-role key. On success this redirects; it only returns on failure.
 *
 * `next` is the destination the user was headed to before login (validated via
 * safeNextPath to a same-origin path); it defaults to /dashboard.
 */
export async function verifyCode(
  email: string,
  code: string,
  next?: string | null,
): Promise<VerifyResult | void> {
  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code.trim(),
    type: "email",
  });

  if (error) {
    return {
      error:
        "That code is invalid or has expired. Check the code, or request a new one.",
    };
  }

  // Cookies are set; the target page forwards to /onboarding if needed.
  redirect(safeNextPath(next));
}
