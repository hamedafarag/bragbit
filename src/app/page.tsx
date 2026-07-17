import { redirect } from "next/navigation";

import { isInstanceSetup } from "@/features/setup/queries";
import { getSessionOrNull } from "@/lib/auth/guards";

/**
 * Root dispatcher — `/` renders nothing of its own; it routes by instance state and
 * session (ENH-CQ-01, replacing the Phase-0 demo mockup). A fresh instance goes to
 * the first-run setup wizard; otherwise a signed-in caller goes to the dashboard and
 * everyone else to sign-in. Reading the session opts this route into dynamic
 * rendering, so it never prerenders at build.
 */
export default async function Home() {
  if (!(await isInstanceSetup())) redirect("/setup");
  const session = await getSessionOrNull();
  redirect(session ? "/dashboard" : "/sign-in");
}
