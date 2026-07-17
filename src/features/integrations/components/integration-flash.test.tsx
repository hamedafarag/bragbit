// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { render } from "@/test/dom";

const replace = vi.hoisted(() => vi.fn());
const toastFns = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("sonner", () => ({ toast: toastFns }));

import { IntegrationFlash } from "./integration-flash";

describe("IntegrationFlash", () => {
  it("toasts success and strips the query for a connected status", () => {
    render(<IntegrationFlash status="github_connected" />);
    expect(toastFns.success).toHaveBeenCalledWith("GitHub connected.");
    expect(replace).toHaveBeenCalledWith("/settings#integrations");
  });

  it("toasts an error for a failed status", () => {
    toastFns.error.mockClear();
    render(<IntegrationFlash status="github_failed" />);
    expect(toastFns.error).toHaveBeenCalled();
  });

  it("does nothing without a status", () => {
    toastFns.success.mockClear();
    toastFns.error.mockClear();
    render(<IntegrationFlash status={undefined} />);
    expect(toastFns.success).not.toHaveBeenCalled();
    expect(toastFns.error).not.toHaveBeenCalled();
  });
});
