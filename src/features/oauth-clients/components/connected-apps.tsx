"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { describeScope } from "@/lib/mcp/scopes";

import { revokeConnectedApp } from "../actions";
import type { ConnectedApp } from "../queries";

/** Settings → Connected apps: the AI clients the user has authorized, with revoke. */
export function ConnectedApps({ apps }: { apps: ConnectedApp[] }) {
  if (apps.length === 0) {
    return (
      <p className="text-[13px] text-ink-soft">
        No apps connected yet. Connect your AI assistant (Claude Desktop, or any MCP client) to log
        wins without leaving your chat.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-line">
      {apps.map((app) => (
        <AppRow key={app.clientId} app={app} />
      ))}
    </ul>
  );
}

function AppRow({ app }: { app: ConnectedApp }) {
  const [pending, start] = useTransition();
  const scopes = app.scopes.split(" ").filter(Boolean);
  // authorizedAt crosses the server→client boundary as a string; normalize.
  const authorized = new Date(app.authorizedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  function revoke() {
    start(async () => {
      const res = await revokeConnectedApp(app.clientId);
      if (res.ok) toast.success(`Revoked ${app.name}.`);
      else toast.error(res.error);
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{app.name}</p>
        <p className="mt-0.5 text-[12px] text-ink-soft">
          Authorized {authorized}
          {scopes.length > 0 ? ` · ${scopes.map(describeScope).join(" · ")}` : ""}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={revoke} disabled={pending}>
        {pending ? "Revoking…" : "Revoke"}
      </Button>
    </li>
  );
}
