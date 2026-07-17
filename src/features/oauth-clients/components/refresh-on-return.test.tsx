// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "@/test/dom";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { RefreshOnReturn } from "./refresh-on-return";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
}

describe("RefreshOnReturn", () => {
  afterEach(() => setVisibility("visible"));

  it("refreshes when the tab becomes visible again", () => {
    render(<RefreshOnReturn />);
    refresh.mockClear();
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh while the tab is hidden", () => {
    render(<RefreshOnReturn />);
    refresh.mockClear();
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).not.toHaveBeenCalled();
  });
});
