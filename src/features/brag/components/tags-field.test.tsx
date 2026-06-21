// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen } from "@/test/dom";

import { TagsField } from "./tags-field";

describe("TagsField", () => {
  it("renders existing tags as removable chips", () => {
    render(<TagsField value={["backend", "api"]} onChange={() => {}} suggestions={[]} />);
    expect(screen.getByText("backend")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove tag api")).toBeInTheDocument();
  });

  it("adds a trimmed, lowercased tag on Enter", () => {
    const onChange = vi.fn();
    render(<TagsField value={["backend"]} onChange={onChange} suggestions={[]} />);
    const input = screen.getByLabelText("Add a tag");
    fireEvent.change(input, { target: { value: "  API  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["backend", "api"]);
  });

  it("adds on a comma too", () => {
    const onChange = vi.fn();
    render(<TagsField value={[]} onChange={onChange} suggestions={[]} />);
    const input = screen.getByLabelText("Add a tag");
    fireEvent.change(input, { target: { value: "perf" } });
    fireEvent.keyDown(input, { key: "," });
    expect(onChange).toHaveBeenCalledWith(["perf"]);
  });

  it("adds the draft on blur", () => {
    const onChange = vi.fn();
    render(<TagsField value={[]} onChange={onChange} suggestions={[]} />);
    const input = screen.getByLabelText("Add a tag");
    fireEvent.change(input, { target: { value: "glue" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(["glue"]);
  });

  it("does not add a duplicate", () => {
    const onChange = vi.fn();
    render(<TagsField value={["backend"]} onChange={onChange} suggestions={[]} />);
    const input = screen.getByLabelText("Add a tag");
    fireEvent.change(input, { target: { value: "backend" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes the last tag on Backspace when the draft is empty", () => {
    const onChange = vi.fn();
    render(<TagsField value={["a", "b"]} onChange={onChange} suggestions={[]} />);
    fireEvent.keyDown(screen.getByLabelText("Add a tag"), { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith(["a"]);
  });

  it("removes a tag via its chip button", () => {
    const onChange = vi.fn();
    render(<TagsField value={["a", "b"]} onChange={onChange} suggestions={[]} />);
    fireEvent.click(screen.getByLabelText("Remove tag a"));
    expect(onChange).toHaveBeenCalledWith(["b"]);
  });

  it("offers the caller's tags as datalist suggestions", () => {
    render(<TagsField value={[]} onChange={() => {}} suggestions={["ci", "devex"]} />);
    const options = document.querySelectorAll("datalist option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveValue("ci");
  });
});
