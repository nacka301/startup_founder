import "server-only";
import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Admin area (PRD §4) gate + helpers. SECURITY: the /admin area exposes every
 * user's data and the billing `plan` lever, so this must fail closed.
 *
 * `requireAdmin()` is the single authorization primitive. It is called at three
 * independent layers — the admin layout, every admin page, and every admin
 * server action — so no single missed check can leak data or allow a write.
 * A logged-in non-admin gets a 404 (not a redirect) so /admin's existence stays
 * hidden. Reads use the returned anon client, whose RLS `is_admin()` policies
 * gate the data a second time at the database.
 */
export async function requireAdmin(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Anonymous callers of a server action reach here (pages are already
    // redirected to /login by middleware). Fail closed with 404.
    notFound();
  }

  // Read through the user's RLS-scoped session (owner may read their own row).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    notFound();
  }

  return { supabase, user };
}

/**
 * Map of user id → email. Emails live in `auth.users`, not `profiles`, so the
 * only source is the service-role admin API. MUST be called after
 * `requireAdmin()` (the service client bypasses RLS).
 *
 * MVP scale: reads a single page. If the page fills up we log a warning — add
 * pagination once the user count approaches this limit (post-MVP).
 */
const EMAIL_PAGE_SIZE = 1000;

export async function getUserEmails(): Promise<Map<string, string>> {
  const service = createServiceClient();
  const { data, error } = await service.auth.admin.listUsers({
    page: 1,
    perPage: EMAIL_PAGE_SIZE,
  });

  const map = new Map<string, string>();
  if (error || !data?.users) {
    return map;
  }
  for (const u of data.users) {
    if (u.email) map.set(u.id, u.email);
  }
  if (data.users.length >= EMAIL_PAGE_SIZE) {
    console.warn(
      `[admin] getUserEmails hit the ${EMAIL_PAGE_SIZE}-user page limit; some emails may be missing. Add pagination.`,
    );
  }
  return map;
}
