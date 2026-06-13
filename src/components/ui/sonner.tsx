"use client";

import * as React from "react";
import { Toaster as Sonner } from "sonner";

// Logbook-themed toast host. Mounted once in the root layout.
export function Toaster(props: React.ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "font-sans rounded-lg border border-line bg-card text-ink shadow-card",
          description: "text-ink-soft",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-secondary text-secondary-foreground",
        },
      }}
      {...props}
    />
  );
}
