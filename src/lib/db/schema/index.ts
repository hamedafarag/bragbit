// Domain schema, split by file and re-exported for the drizzle client and
// drizzle-kit.
//   auth.ts       Better Auth core: user / session / account / verification
//   workspace.ts  organization (= workspace) / member / invitation
//   profile.ts    per-user profile (display name, role, team, bio, avatar)
//   document.ts   documents (review periods, workspace + user scoped)
//   brag.ts       brags / brag_links / tags / brag_tags (the brag domain)
//   share.ts      share_links (revocable public links to a document)
//   oauth.ts      OAuth 2.1 provider tables (Better Auth mcp plugin) for the MCP connector
//   (column helpers in ./columns)
//
// Convention (PLAN.md §6): every workspace-scoped table carries a workspace
// reference and is only ever read/written through the DAL guards.

export * from "./auth";
export * from "./workspace";
export * from "./profile";
export * from "./document";
export * from "./brag";
export * from "./share";
export * from "./oauth";
export * from "./rate-limit";
