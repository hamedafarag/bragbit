"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { connectPat, disconnectProvider, importNow } from "../actions";
import { patConnectSchema, type AuthType, type Provider } from "../schema";

/** A provider + the caller's connection to it, if any — plain data from the Server Component. */
export type ProviderCardData = {
  id: Provider;
  label: string;
  supportsPat: boolean;
  oauthConfigured: boolean;
  connection: {
    authType: AuthType;
    externalAccountLabel: string | null;
    lastSyncedAt: string | null;
  } | null;
};

/** The GitHub mark (lucide has no GitHub icon in this version). */
function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-5" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** The Linear mark (lucide has no Linear icon in this version). */
function LinearMark() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="size-5" fill="currentColor">
      <path d="M1.225 61.523c-.222-.95.908-1.546 1.597-.857l36.512 36.512c.69.69.092 1.819-.857 1.597C20.552 94.918 5.082 79.448 1.225 61.523zM.002 46.889a.99.99 0 00.29.76L52.35 99.71a.99.99 0 00.76.29c1.246-.05 2.477-.15 3.694-.298.868-.107 1.164-1.173.548-1.79L2.088 42.647c-.616-.616-1.682-.32-1.79.548-.147 1.217-.248 2.448-.296 3.694zM3.898 27.827a.977.977 0 00.21 1.076l66.987 66.988a.977.977 0 001.077.21 49.902 49.902 0 005.02-2.395.977.977 0 00.203-1.554L7.652 22.603a.977.977 0 00-1.554.203 49.9 49.9 0 00-2.2 5.02zM12.895 14.049a.988.988 0 00-.024 1.357l58.722 58.722a.988.988 0 001.357-.024 50.6 50.6 0 003.34-3.61.986.986 0 00-.05-1.318L17.874 10.76a.986.986 0 00-1.318-.05 50.6 50.6 0 00-3.66 3.34zM25.276 5.354c-.7-.51-.44-1.62.42-1.75A50.093 50.093 0 0150.002 0c27.615 0 50 22.386 50 50 0 8.15-1.95 15.85-5.41 22.66-.13.86-1.24 1.12-1.75.42L25.276 5.354z" />
    </svg>
  );
}

const ICON: Record<Provider, () => React.ReactNode> = { github: GithubMark, linear: LinearMark };

/** Where the user creates a scoped token for each provider (shown on the connect form). */
const TOKEN_HELP: Record<Provider, { href: string; scopeHint: string }> = {
  github: {
    href: "https://github.com/settings/personal-access-tokens",
    scopeHint: "read-only access to pull requests",
  },
  linear: {
    href: "https://linear.app/settings/account/security",
    scopeHint: "read-only access to your issues",
  },
};

/** Provider-specific card copy — the source noun and the token's name differ per provider. */
const COPY: Record<Provider, { blurb: string; tokenNoun: string }> = {
  github: {
    blurb: "Import your merged pull requests as brags you review before they're logged.",
    tokenNoun: "personal access token",
  },
  linear: {
    blurb: "Import your completed issues as brags you review before they're logged.",
    tokenNoun: "API key",
  },
};

function ProviderCard({ data }: { data: ProviderCardData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [token, setToken] = useState("");
  const Icon = ICON[data.id];
  const help = TOKEN_HELP[data.id];
  const copy = COPY[data.id];
  const connected = data.connection !== null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  function connect() {
    const parsed = patConnectSchema.safeParse({ provider: data.id, token });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Paste a token.");
      return;
    }
    start(async () => {
      const res = await connectPat(parsed.data);
      if (res.ok) {
        toast.success(`Connected ${data.label}.`);
        setToken("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-card p-5 shadow-card">
      <div className="flex items-center gap-2.5">
        <Icon />
        <span className="font-serif text-base font-semibold">{data.label}</span>
        <Badge variant={connected ? "default" : "outline"} className="ml-auto">
          {connected ? "Connected" : "Not connected"}
        </Badge>
      </div>

      {connected ? (
        <>
          <p className="text-[13px] text-ink-soft">
            Connected as{" "}
            <span className="font-medium text-ink">
              {data.connection!.externalAccountLabel ?? "your account"}
            </span>
            {data.connection!.lastSyncedAt
              ? ` · last imported ${new Date(data.connection!.lastSyncedAt).toLocaleDateString()}`
              : " · not imported yet"}
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => run(() => importNow(data.id), "Import finished.")}
              disabled={pending}
            >
              {pending ? "Working…" : "Import now"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => run(() => disconnectProvider(data.id), `Disconnected ${data.label}.`)}
              disabled={pending}
            >
              Disconnect
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] text-ink-soft">{copy.blurb}</p>
          {data.oauthConfigured && (
            <a
              href={`/api/integrations/${data.id}/authorize`}
              className={buttonVariants({ size: "sm" })}
            >
              Connect with {data.label}
            </a>
          )}
          <div className="flex flex-col gap-2">
            {data.oauthConfigured && (
              <span className="font-mono text-[10.5px] text-ink-faint">or paste a token</span>
            )}
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={`Paste your ${copy.tokenNoun}`}
              className="font-mono text-[12px]"
              aria-label={`${data.label} ${copy.tokenNoun}`}
              disabled={pending}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={data.oauthConfigured ? "outline" : "default"}
                onClick={connect}
                disabled={pending}
              >
                {pending ? "Connecting…" : data.oauthConfigured ? "Use a token" : "Connect"}
              </Button>
              <a
                href={help.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-ink-soft hover:text-ink"
              >
                Create a token
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </div>
            <p className="font-mono text-[10.5px] text-ink-faint">
              Needs {help.scopeHint}. Stored encrypted; revoke it anytime here or on {data.label}.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/** Settings → Integrations: one card per available provider (v1: GitHub). */
export function IntegrationCards({ cards }: { cards: ProviderCardData[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((c) => (
        <ProviderCard key={c.id} data={c} />
      ))}
    </div>
  );
}
