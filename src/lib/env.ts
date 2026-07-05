/**
 * Validated public environment variables.
 *
 * Referencing `process.env.NEXT_PUBLIC_*` directly here lets Next inline the
 * values at build time, while the guard makes a missing/blank var fail loudly
 * at startup instead of surfacing as a cryptic error deep in the Supabase client.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_ANON_KEY = required(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
