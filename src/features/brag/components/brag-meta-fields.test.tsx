// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { render, screen } from "@/test/dom";

import { BRAG_CATEGORIES } from "../schema";
import { BragMetaFields } from "./brag-meta-fields";

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("BragMetaFields", () => {
  it("defaults the date to today and selects nothing when no props are given", () => {
    render(<BragMetaFields />);
    expect(screen.getByLabelText("Date")).toHaveValue(todayLocal());
    expect(screen.getByLabelText("Category")).toHaveValue("");
    expect(screen.getByLabelText("Status")).toHaveValue("");
  });

  it("renders the full category taxonomy plus a None option", () => {
    render(<BragMetaFields />);
    const options = screen.getByLabelText("Category").querySelectorAll("option");
    expect(options).toHaveLength(BRAG_CATEGORIES.length + 1); // + the "— None —" placeholder
    expect(screen.getByRole("option", { name: "Shipped work" })).toBeInTheDocument();
  });

  it("reflects provided date / category / status", () => {
    render(<BragMetaFields date="2026-01-15" category="leadership" status="shipped" />);
    expect(screen.getByLabelText("Date")).toHaveValue("2026-01-15");
    expect(screen.getByLabelText("Category")).toHaveValue("leadership");
    expect(screen.getByLabelText("Status")).toHaveValue("shipped");
  });
});
