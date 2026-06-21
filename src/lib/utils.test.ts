import { describe, expect, it } from "vitest";

import { accentVars, cn, thumbUrl } from "./utils";

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
