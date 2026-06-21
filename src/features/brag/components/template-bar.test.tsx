// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/dom";

import { BRAG_TEMPLATES } from "../templates";

// TemplateBar's job is to render a chip per template and hand the editor that
// template's seeded `initial`. Mock the heavy editor (dialog + server actions)
// to just render its trigger and record the `initial` it received.
const { editorInitials } = vi.hoisted(() => ({
  editorInitials: [] as Array<{ category?: string; status?: string; descriptionMd?: string }>,
}));

vi.mock("./brag-editor", () => ({
  BragEditor: (props: { initial?: Record<string, unknown>; trigger?: ReactNode }) => {
    editorInitials.push(props.initial as (typeof editorInitials)[number]);
    return <div data-testid="editor">{props.trigger}</div>;
  },
}));

// Imported after the mock so it picks up the stubbed BragEditor.
import { TemplateBar } from "./template-bar";

describe("TemplateBar", () => {
  it("renders a chip for every template under a 'Start from' label", () => {
    render(<TemplateBar documentId="doc-1" />);
    expect(screen.getByText("Start from")).toBeInTheDocument();
    for (const t of BRAG_TEMPLATES) {
      expect(screen.getByRole("button", { name: t.label })).toBeInTheDocument();
    }
  });

  it("seeds each editor with the matching template's category, status, and scaffold", () => {
    editorInitials.length = 0;
    render(<TemplateBar documentId="doc-1" />);
    expect(editorInitials).toHaveLength(BRAG_TEMPLATES.length);
    for (const t of BRAG_TEMPLATES) {
      const match = editorInitials.find(
        (v) => v.category === t.category && v.descriptionMd === t.descriptionMd,
      );
      expect(match, `initial for "${t.label}"`).toBeTruthy();
      expect(match?.status).toBe(t.status ?? "");
    }
  });
});
