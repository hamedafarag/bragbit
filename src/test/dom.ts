import { afterEach } from "vitest";

import { cleanup } from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

/**
 * Shared setup for jsdom component tests. Import this (instead of
 * `@testing-library/react` directly) from a test file that opens with
 * `// @vitest-environment jsdom` — it registers the jest-dom matchers and
 * unmounts React trees between tests (RTL doesn't auto-clean without Vitest
 * globals). Only jsdom test files import it, so the node-env suites never load
 * jsdom or jest-dom. Excluded from coverage via the `src/test/**` rule.
 */
afterEach(() => {
  cleanup();
});

export * from "@testing-library/react";
