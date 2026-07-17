/**
 * OAuth scopes the MCP connector exposes, in one place so the auth config
 * (src/lib/auth), the consent screen (/oauth/consent) and the tool guards
 * (src/app/api/mcp) never drift. Plain constants — safe to import from client
 * and server alike (no "server-only").
 *
 * `openid` / `profile` are the standard OIDC identity scopes; the two
 * BragBit scopes gate the tools. Capture-first: writing brags is the default
 * ask; reading the document list is the only read scope in the MVP (see
 * docs/specs/mcp-connector.md — search over career data stays out of scope).
 */
export const MCP_SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: "Confirm your identity",
  profile: "Read your basic profile (your name)",
  offline_access: "Stay connected without re-authorizing every session",
  "brags:write": "Add wins to your BragBit timeline",
  "documents:read": "See the list of your documents",
};

/** Scopes advertised in OAuth discovery and requestable by a client. */
export const MCP_SUPPORTED_SCOPES = Object.keys(MCP_SCOPE_DESCRIPTIONS);

/** The scope each tool requires. The MCP handler denies a call whose token lacks it. */
export const MCP_TOOL_SCOPES = {
  addBrag: "brags:write",
  listDocuments: "documents:read",
} as const;

/** Human-readable label for a scope, falling back to the raw scope string. */
export function describeScope(scope: string): string {
  return MCP_SCOPE_DESCRIPTIONS[scope] ?? scope;
}
