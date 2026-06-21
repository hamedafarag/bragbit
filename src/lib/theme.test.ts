import { describe, expect, it } from "vitest";

import { resolveTheme, themeClass } from "./theme";

describe("themeClass", () => {
  it("returns 'dark' only for the dark cookie value", () => {
    expect(themeClass("dark")).toBe("dark");
    expect(themeClass("light")).toBe("");
    expect(themeClass(undefined)).toBe("");
    expect(themeClass("")).toBe("");
  });
});

describe("resolveTheme", () => {
  it("prefers the cookie over the system preference", () => {
    expect(resolveTheme("theme=dark", false)).toBe("dark");
    expect(resolveTheme("theme=light", true)).toBe("light");
    expect(resolveTheme("foo=1; theme=dark; bar=2", false)).toBe("dark");
  });

  it("falls back to the system preference when there's no cookie", () => {
    expect(resolveTheme("", true)).toBe("dark");
    expect(resolveTheme("other=x", true)).toBe("dark");
    expect(resolveTheme("other=x", false)).toBe("light");
  });
});
