import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Shown for notFound() in the app (e.g. a document you don't own) — keeps the chrome. */
export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-dashed border-line bg-card/60 px-6 py-14 text-center shadow-card">
      <h1 className="font-serif text-[22px] font-semibold">Not found</h1>
      <p className="mx-auto mt-1.5 max-w-[44ch] text-[13.5px] text-ink-soft">
        This page or document doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Button asChild className="mt-5">
        <Link href="/dashboard">Back to your documents</Link>
      </Button>
    </div>
  );
}
