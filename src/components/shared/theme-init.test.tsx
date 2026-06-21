// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "@/test/dom";

import { ThemeInit } from "./theme-init";

function mockSystemDark(dark: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: dark }));
}

beforeEach(() => {
  document.documentElement.classList.remove("dark");
  document.cookie = "theme=; max-age=0; path=/";
});
afterEach(() => vi.unstubAllGlobals());

describe("ThemeInit", () => {
  it("applies dark when there's no cookie and the OS prefers dark", () => {
    mockSystemDark(true);
    render(<ThemeInit />);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("does nothing when the OS prefers light", () => {
    mockSystemDark(false);
    render(<ThemeInit />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("never overrides an explicit cookie choice", () => {
    document.cookie = "theme=light; path=/";
    mockSystemDark(true);
    render(<ThemeInit />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
