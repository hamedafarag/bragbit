import { describe, expect, it } from "vitest";

import { accentCss, accentVars, cn, thumbUrl } from "./utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("dedupes conflicting Tailwind utilities (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "c")).toBe("a c");
  });
});

describe("thumbUrl", () => {
  it("adds ?w= to a bare url", () => {
    expect(thumbUrl("/api/files/ws/avatars/a.png", 192)).toBe("/api/files/ws/avatars/a.png?w=192");
  });

  it("adds &w= when the url already carries a query", () => {
    expect(thumbUrl("/api/files/ws/attachments/x.png?token=abc", 64)).toBe(
      "/api/files/ws/attachments/x.png?token=abc&w=64",
    );
  });
});

describe("accentVars", () => {
  it("returns undefined for a missing or malformed hex", () => {
    expect(accentVars(null)).toBeUndefined();
    expect(accentVars(undefined)).toBeUndefined();
    expect(accentVars("e8590c")).toBeUndefined(); // missing '#'
    expect(accentVars("#fff")).toBeUndefined(); // not 6 digits
  });

  it("sets --primary and --ring to the accent", () => {
    const v = accentVars("#4338ca") as Record<string, string>;
    expect(v["--primary"]).toBe("#4338ca");
    expect(v["--ring"]).toBe("#4338ca");
  });

  it("uses white button text on a dark accent and ink on a light one (WCAG)", () => {
    expect((accentVars("#4338ca") as Record<string, string>)["--primary-foreground"]).toBe(
      "#ffffff",
    );
    expect((accentVars("#b08a2e") as Record<string, string>)["--primary-foreground"]).toBe(
      "#221d16",
    );
  });
});

describe("accentCss", () => {
  it("returns undefined for a missing or malformed hex, so the default palette stands", () => {
    expect(accentCss(null)).toBeUndefined();
    expect(accentCss(undefined)).toBeUndefined();
    expect(accentCss("e8590c")).toBeUndefined();
    expect(accentCss("#fff")).toBeUndefined();
  });

  it("emits the accent variables as a :root rule", () => {
    // :root, not a wrapper's inline style: dialogs portal into document.body and
    // the toaster mounts in the root layout, so both sit outside any wrapper and
    // would otherwise fall back to the default accent.
    // (Ink wins the foreground here — it out-contrasts white on a mid-tone green.)
    const css = accentCss("#5c8a58");
    expect(css).toBe(":root{--primary:#5c8a58;--ring:#5c8a58;--primary-foreground:#221d16}");
  });

  it("carries the luminance-picked foreground through from accentVars", () => {
    expect(accentCss("#b08a2e")).toContain("--primary-foreground:#221d16");
    expect(accentCss("#4338ca")).toContain("--primary-foreground:#ffffff");
  });

  it("cannot emit anything but a validated hex and a literal foreground", () => {
    // The value is interpolated into a stylesheet, so the regex in accentVars is
    // the injection guard — anything that isn't #rrggbb must produce no CSS.
    expect(accentCss("#5c8a58;} body{display:none}")).toBeUndefined();
    expect(accentCss("red")).toBeUndefined();
    expect(accentCss("</style><script>alert(1)</script>")).toBeUndefined();
    expect(accentCss("#5c8a58 ")).toBeUndefined();
  });
});
