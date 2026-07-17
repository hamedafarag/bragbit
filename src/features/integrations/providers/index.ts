import type { Provider } from "../schema";

import { githubProvider } from "./github";
import { type IntegrationProvider, isProviderAvailable } from "./types";

// Provider registry (docs/specs/integrations.md). The single source the routes and
// the settings UI resolve adapters through — mirrors lib/oauth.ts's
// configuredOAuthProviders(): only reachable providers surface, so a provider a
// self-host hasn't set up simply doesn't appear.

const REGISTRY: Record<Provider, IntegrationProvider> = {
  github: githubProvider,
};

/** The adapter for `provider`. */
export function getProvider(provider: Provider): IntegrationProvider {
  return REGISTRY[provider];
}

/** Every provider reachable on this instance (OAuth configured or PAT-capable). */
export function availableProviders(): IntegrationProvider[] {
  return Object.values(REGISTRY).filter(isProviderAvailable);
}

export type { IntegrationProvider } from "./types";
