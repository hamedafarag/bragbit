// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen } from "@/test/dom";

import { LinksField } from "./links-field";

describe("LinksField", () => {
  it("adds an empty row via the add button", () => {
    const onChange = vi.fn();
    render(<LinksField value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /add link/i }));
    expect(onChange).toHaveBeenCalledWith([{ url: "", label: "" }]);
  });

  it("renders a url + label input per row", () => {
    render(<LinksField value={[{ url: "https://x.test", label: "PR" }]} onChange={() => {}} />);
    expect(screen.getByLabelText("Link 1 URL")).toHaveValue("https://x.test");
    expect(screen.getByLabelText("Link 1 label")).toHaveValue("PR");
  });

  it("updates a row's url and label independently", () => {
    const onChange = vi.fn();
    render(<LinksField value={[{ url: "", label: "" }]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Link 1 URL"), { target: { value: "https://y.test" } });
    expect(onChange).toHaveBeenCalledWith([{ url: "https://y.test", label: "" }]);
  });

  it("patches only the targeted row in a multi-row list", () => {
    const onChange = vi.fn();
    render(
      <LinksField
        value={[
          { url: "a", label: "" },
          { url: "b", label: "" },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Link 2 label"), { target: { value: "Dash" } });
    expect(onChange).toHaveBeenCalledWith([
      { url: "a", label: "" },
      { url: "b", label: "Dash" },
    ]);
  });

  it("removes the targeted row", () => {
    const onChange = vi.fn();
    render(
      <LinksField
        value={[
          { url: "a", label: "" },
          { url: "b", label: "" },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Remove link 1"));
    expect(onChange).toHaveBeenCalledWith([{ url: "b", label: "" }]);
  });
});
