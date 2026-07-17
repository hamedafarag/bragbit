import { redirect } from "next/navigation";

import { isInstanceSetup } from "@/features/setup/queries";
import { getSessionOrNull } from "@/lib/auth/guards";
import { isPrivate } from "@/lib/instance";

/**
 * Root dispatcher — `/` renders nothing of its own; it routes by instance mode and
 * session (ENH-CQ-01, replacing the Phase-0 demo mockup). Private modes send a fresh
 * instance to the first-run setup wizard; otherwise a signed-in caller goes to the
 * dashboard and everyone else to sign-in. A public marketing landing for `hosted`
 * mode is deferred to Phase 10 (see docs/enhancements.md). Reading the session opts
 * this route into dynamic rendering, so it never prerenders at build.
 */
export default async function Home() {
  if (isPrivate() && !(await isInstanceSetup())) redirect("/setup");
  const session = await getSessionOrNull();
  redirect(session ? "/dashboard" : "/sign-in");
}
