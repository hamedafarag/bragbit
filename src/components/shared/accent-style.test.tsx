// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { render } from "@/test/dom";

import { AccentStyle } from "./accent-style";

describe("AccentStyle", () => {
  it("publishes the accent at :root, not on a wrapper", () => {
    // The regression this guards: a wrapper's inline style never reaches Radix
    // dialogs (portalled into document.body) or sonner toasts (mounted in the
    // root layout), so a white-labeled workspace rendered them in the default
    // orange. `:root` is inherited by body, so portalled content is branded too.
    const { container } = render(<AccentStyle accent="#5c8a58" />);
    const style = container.querySelector("style");

    expect(style).not.toBeNull();
    expect(style?.textContent).toContain(":root{");
    expect(style?.textContent).toContain("--primary:#5c8a58");
    expect(style?.textContent).toContain("--ring:#5c8a58");
  });

  it("renders nothing without a valid accent, leaving the default palette", () => {
    expect(render(<AccentStyle accent={null} />).container.querySelector("style")).toBeNull();
    expect(render(<AccentStyle accent={undefined} />).container.querySelector("style")).toBeNull();
    expect(render(<AccentStyle accent="nope" />).container.querySelector("style")).toBeNull();
  });

  it("actually applies to elements outside its own subtree", () => {
    // The whole point: a sibling standing in for a portal must resolve the accent.
    render(<AccentStyle accent="#4338ca" />);
    const portalLike = document.createElement("div");
    document.body.appendChild(portalLike);

    expect(getComputedStyle(portalLike).getPropertyValue("--primary").trim()).toBe("#4338ca");

    portalLike.remove();
  });
});
