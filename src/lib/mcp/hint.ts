// Dismiss state for the dashboard's "connect your AI assistant" hint. The MCP
// connector is otherwise invisible — nothing in the app tells you it exists — so
// the dashboard nudges once. A cookie (not localStorage) persists the dismissal
// so the *server* can decide not to render it at all: the same no-flash reasoning
// as the theme cookie (lib/theme.ts). Pure helpers, so they unit-test apart from
// next/headers.

export const MCP_HINT_COOKIE = "mcp-hint";

const DISMISSED = "dismissed";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** True once the caller has dismissed the connector hint. */
export function isMcpHintDismissed(cookieValue: string | undefined): boolean {
  return cookieValue === DISMISSED;
}

/** The `document.cookie` string the hint writes when dismissed. */
export function mcpHintDismissCookie(): string {
  return `${MCP_HINT_COOKIE}=${DISMISSED}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
