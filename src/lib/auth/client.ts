import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Client-side auth hooks/actions. baseURL is inferred from the current origin.
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
