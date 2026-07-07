import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { buttonVariants } from "@/components/ui/button";

/**
 * Admin area shell (PRD §4). Route-level gate: requireAdmin() 404s any
 * non-admin before a child page renders. Every page and action re-checks
 * independently — this layout is the first layer, not the only one.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <main className="mx-auto flex min-h-screen max-w-[1100px] flex-col gap-8 px-6 py-16">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <nav className="flex items-center gap-1">
          <Link href="/admin" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Users
          </Link>
          <Link
            href="/admin/analyses"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Analyses
          </Link>
          <Link
            href="/admin/costs"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            LLM spend
          </Link>
        </nav>
      </div>
      {children}
    </main>
  );
}
