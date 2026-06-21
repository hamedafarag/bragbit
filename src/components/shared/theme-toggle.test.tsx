// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen } from "@/test/dom";

import { ThemeToggle } from "./theme-toggle";

function mockSystemDark(dark: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: dark }));
}

beforeEach(() => {
  document.documentElement.classList.remove("dark");
  document.cookie = "theme=; max-age=0; path=/";
  mockSystemDark(false);
});
afterEach(() => vi.unstubAllGlobals());

describe("ThemeToggle", () => {
  it("toggles to dark, persists a cookie, and flips the label", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText("Switch to dark mode"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.cookie).toContain("theme=dark");
    expect(screen.getByLabelText("Switch to light mode")).toBeInTheDocument();
  });

  it("toggles back to light", () => {
    document.cookie = "theme=dark; path=/";
    document.documentElement.classList.add("dark");
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText("Switch to light mode"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.cookie).toContain("theme=light");
  });

  it("reflects an existing dark cookie on mount", () => {
    document.cookie = "theme=dark; path=/";
    render(<ThemeToggle />);
    expect(screen.getByLabelText("Switch to light mode")).toBeInTheDocument();
  });

  it("reflects the OS preference when there's no cookie", () => {
    mockSystemDark(true);
    render(<ThemeToggle />);
    expect(screen.getByLabelText("Switch to light mode")).toBeInTheDocument();
  });
});
