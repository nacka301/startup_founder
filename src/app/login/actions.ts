"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type VerifyResult = { error: string };

/**
 * Verify the 6-digit email OTP server-side so the auth cookies are committed by
 * the server before we navigate (a client-side verify races the cookie write,
 * which bounced users back to /login). Uses the anon-key server client — never
 * the service-role key. On success this redirects; it only returns on failure.
 */
export async function verifyCode(
  email: string,
  code: string,
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

  // Cookies are set; the dashboard forwards to /onboarding if needed.
  redirect("/dashboard");
}
