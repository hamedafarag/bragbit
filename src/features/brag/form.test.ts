import { describe, expect, it } from "vitest";

import { parseBragForm } from "./form";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("parseBragForm", () => {
  it("parses a minimal valid form (title + date) with schema defaults", () => {
    const r = parseBragForm(fd({ title: "Shipped X", date: "2026-06-17" }), [], []);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.title).toBe("Shipped X");
      expect(r.data.visibility).toBe("shared"); // no "private" checkbox present
      expect(r.data.category).toBe("");
      expect(r.data.links).toEqual([]);
      expect(r.data.tags).toEqual([]);
    }
  });

  it("maps the 'private' checkbox to visibility=private", () => {
    const r = parseBragForm(fd({ title: "T", date: "2026-06-17", private: "on" }), [], []);
    expect(r.success && r.data.visibility).toBe("private");
  });

  it("drops blank link rows before URL validation", () => {
    const r = parseBragForm(
      fd({ title: "T", date: "2026-06-17" }),
      [
        { url: "  ", label: "blank" },
        { url: "https://example.com/pr/1", label: "PR" },
      ],
      [],
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.links).toHaveLength(1);
      expect(r.data.links[0]?.url).toBe("https://example.com/pr/1");
    }
  });

  it("lowercases tags", () => {
    const r = parseBragForm(fd({ title: "T", date: "2026-06-17" }), [], ["Backend", "API"]);
    expect(r.success && r.data.tags).toEqual(["backend", "api"]);
  });

  it("rejects a missing title", () => {
    expect(parseBragForm(fd({ title: "  ", date: "2026-06-17" }), [], []).success).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(parseBragForm(fd({ title: "T", date: "06/17/2026" }), [], []).success).toBe(false);
  });

  it("rejects a non-absolute link URL", () => {
    const r = parseBragForm(
      fd({ title: "T", date: "2026-06-17" }),
      [{ url: "not-a-url", label: "" }],
      [],
    );
    expect(r.success).toBe(false);
  });
});
