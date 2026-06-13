// Domain schema, split by file and re-exported for the drizzle client and
// drizzle-kit.
//   auth.ts       Better Auth core: user / session / account / verification
//   workspace.ts  organization (= workspace) / member / invitation
//   profile.ts    per-user profile (display name, role, team, bio, avatar)
//   (document / brag / share land in Phase 3 / 6; column helpers in ./columns)
//
// Convention (PLAN.md §6): every workspace-scoped table carries a workspace
// reference and is only ever read/written through the DAL guards.

export * from "./auth";
export * from "./workspace";
export * from "./profile";
