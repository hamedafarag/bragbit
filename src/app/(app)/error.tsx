"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Error boundary for the authenticated app — renders inside the (app) chrome. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md rounded-xl border border-dashed border-line bg-card/60 px-6 py-14 text-center shadow-card">
      <h1 className="font-serif text-[22px] font-semibold">Something went wrong</h1>
      <p className="mx-auto mt-1.5 max-w-[44ch] text-[13.5px] text-ink-soft">
        An unexpected error interrupted this page. Try again — if it keeps happening, reload.
      </p>
      <Button type="button" onClick={reset} className="mt-5">
        Try again
      </Button>
    </div>
  );
}
