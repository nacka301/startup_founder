import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client authenticated with the SERVICE-ROLE key. It bypasses Row Level
 * Security, so it must only be used in Server Actions / Route Handlers AFTER the
 * caller's identity and permissions have been verified. Never import this into a
 * Client Component — the `server-only` guard turns that into a build error.
 *
 * The service-role key is read straight from `process.env` (not `@/lib/env`,
 * which is bundled into client code) so the secret never reaches the browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
