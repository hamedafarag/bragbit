"use client";

import { Check, Copy } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeScope } from "@/lib/mcp/scopes";

import { revokeConnectedApp } from "../actions";
import type { ConnectedApp } from "../queries";

/**
 * How to connect, shown when nothing is authorized yet. The MCP server URL is the
 * only thing a client needs (it discovers the OAuth flow from there), so hand it
 * over ready to copy rather than describing it.
 */
function ConnectSteps({ mcpServerUrl }: { mcpServerUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(mcpServerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <p className="text-[13px] text-ink-soft">
        Nothing connected yet. Add BragBit to Claude — or any MCP client — and log wins without
        leaving your chat.
      </p>
      <ol className="mt-4 flex flex-col gap-3 text-[13px] text-ink-soft">
        <li>
          <span className="font-medium text-ink">1.</span> In your assistant, add a custom connector
          with this MCP server URL:
          <div className="mt-2 flex items-center gap-2">
            <Input
              readOnly
              value={mcpServerUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-[12px]"
              aria-label="Your BragBit MCP server URL"
            />
            <Button type="button" variant="outline" size="sm" onClick={copy}>
              {copied ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </li>
        <li>
          <span className="font-medium text-ink">2.</span> Sign in if it asks, then click{" "}
          <span className="font-medium text-ink">Authorize</span>
          {" — there's no token to paste."}
        </li>
        <li>
          <span className="font-medium text-ink">3.</span> Try it:{" "}
          <span className="italic">
            &ldquo;Brag: shipped the realtime heatmap, cut lookup time 22 → 5 min.&rdquo;
          </span>
        </li>
      </ol>
    </div>
  );
}

/** Settings → Connected apps: the AI clients the user has authorized, with revoke. */
export function ConnectedApps({
  apps,
  mcpServerUrl,
}: {
  apps: ConnectedApp[];
  mcpServerUrl: string;
}) {
  if (apps.length === 0) return <ConnectSteps mcpServerUrl={mcpServerUrl} />;
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
