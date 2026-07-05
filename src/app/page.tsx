import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[720px] flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Get an honest verdict on your business idea
      </h1>
      <p className="text-muted-foreground">
        Evidence-backed, scored 1–100. The full landing page is coming soon.
      </p>
      <Link href="/login" className={buttonVariants()}>
        Get started
      </Link>
    </main>
  );
}
