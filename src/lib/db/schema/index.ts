// Domain schema, split by file and re-exported here for the drizzle client and
// drizzle-kit. Tables land per-phase:
//   auth.ts       Better Auth (user / session / account / verification) — Phase 1
//   workspace.ts  workspaces, members, invitations                      — Phase 1
//   document.ts   documents                                             — Phase 3
//   brag.ts       brags, brag_links, attachments, tags, brag_tags       — Phase 3
//   share.ts      share_links                                           — Phase 6
//
// Convention (PLAN.md §6): every workspace-scoped table carries `workspaceId`
// and is only ever read/written through the DAL guards — nothing outside the
// DAL imports the drizzle client. Shared column helpers live in ./columns.

export {};
