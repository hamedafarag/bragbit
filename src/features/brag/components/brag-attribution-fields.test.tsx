// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { render, screen } from "@/test/dom";

import { BragAttributionFields } from "./brag-attribution-fields";

describe("BragAttributionFields", () => {
  it("renders empty collaborators + attribution inputs by default", () => {
    render(<BragAttributionFields />);
    expect(screen.getByLabelText("Collaborators")).toHaveValue("");
    expect(screen.getByLabelText("Attribution")).toHaveValue("");
  });

  it("reflects provided values", () => {
    render(<BragAttributionFields collaborators="Data team, N. Osei" attribution="Sara M." />);
    expect(screen.getByLabelText("Collaborators")).toHaveValue("Data team, N. Osei");
    expect(screen.getByLabelText("Attribution")).toHaveValue("Sara M.");
  });
});
