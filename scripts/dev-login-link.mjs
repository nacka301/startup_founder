/**
 * Dev-only: mint a magic-link login URL without sending an email.
 *
 * Magic-link email testing is fragile (hourly send rate limits, Gmail
 * pre-scanning single-use links, older links being invalidated). This uses the
 * service-role key to generate a link's token_hash and prints a URL that hits
 * our /auth/callback directly, which verifies it server-side (no PKCE cookie,
 * no email). Open the printed URL in the browser to sign in.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dev-login-link.mjs <email> [siteUrl]
 *   npm run dev:login -- you@example.com
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (server-only secret).
 * Refuses to run against a non-local Supabase URL unless ALLOW_REMOTE=1.
 * NEVER run this against production or commit generated links.
 */
import { createClient } from "@supabase/supabase-js";

const USAGE =
  "Usage: node --env-file=.env.local scripts/dev-login-link.mjs <email> [siteUrl]";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];
const siteUrl = process.argv[3] ?? "http://localhost:3000";

if (!url || !serviceRole) {
  console.error(`Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).\n${USAGE}`);
  process.exit(1);
}

if (!email) {
  console.error(`Missing email argument.\n${USAGE}`);
  process.exit(1);
}

// The service-role key is all-powerful; make it hard to point this at a hosted
// project by accident. Local Supabase runs on 127.0.0.1/localhost.
const host = new URL(url).hostname;
const isLocal = host === "127.0.0.1" || host === "localhost";
if (!isLocal && process.env.ALLOW_REMOTE !== "1") {
  console.error(
    `Refusing to run against non-local Supabase URL (${host}). ` +
      "Set ALLOW_REMOTE=1 to override — never do this for production.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email,
});

if (error) {
  console.error(`Failed to generate link for ${email}: ${error.message}`);
  process.exit(1);
}

const tokenHash = data.properties?.hashed_token;
if (!tokenHash) {
  console.error("No token_hash returned; cannot build a callback URL.");
  process.exit(1);
}

const loginUrl = `${siteUrl}/auth/callback?token_hash=${tokenHash}&type=magiclink`;

console.log(`\nLogin link for ${email} (single use, expires ~1h):\n`);
console.log(loginUrl);
console.log("\nOpen it in your browser while `npm run dev` is running.\n");
