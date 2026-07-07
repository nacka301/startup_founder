"use server";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

export type WaitlistResult =
  | { error: string }
  | { ok: true; already: boolean };

// Validate the normalized (trimmed + lowercased) address. 320 is the practical
// RFC max length for an email.
const emailSchema = z.string().email().max(320);

/**
 * Join the public waitlist. Safe for anonymous visitors: the insert goes through
 * the service-role client (which bypasses RLS) but only ever writes a validated
 * email into `waitlist` — no user data, no secrets reach the browser.
 *
 * Duplicate emails are treated as success (`already: true`) so re-submitting is a
 * friendly "you're already on the list", never a raw unique-violation error.
 */
export async function joinWaitlist(rawEmail: string): Promise<WaitlistResult> {
  const email = rawEmail.trim().toLowerCase();

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { error: "Please enter a valid email address." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from("waitlist")
    .insert({ email: parsed.data, source: "landing" });

  if (error) {
    // 23505 = unique_violation → already on the list.
    if (error.code === "23505") {
      return { ok: true, already: true };
    }
    console.error("Waitlist insert failed:", error.message);
    return { error: "Something went wrong. Please try again." };
  }

  return { ok: true, already: false };
}
