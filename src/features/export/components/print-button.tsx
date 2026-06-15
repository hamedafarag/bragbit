"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog (→ "Save as PDF"). Hidden in the printed output. */
export function PrintButton() {
  return (
    <Button type="button" size="sm" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-3.5" aria-hidden />
      Print / Save as PDF
    </Button>
  );
}
