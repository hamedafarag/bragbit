import * as React from "react";

import { cn } from "@/lib/utils";

/** A pulsing placeholder block, on the logbook paper tone. Used in route loading.tsx. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-paper-deep", className)} {...props} />;
}

export { Skeleton };
