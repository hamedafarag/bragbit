// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { render, screen } from "@/test/dom";

import { buildActivity } from "../activity";
import { ActivityHeatmap } from "./activity-heatmap";

const TODAY = "2026-06-17";

describe("ActivityHeatmap", () => {
  it("renders the streak, total, legend, and a screen-reader summary", () => {
    const data = buildActivity(
      [
        { date: "2026-06-15", count: 2 },
        { date: "2026-06-10", count: 1 },
      ],
      TODAY,
      4,
    );
    render(<ActivityHeatmap data={data} />);

    expect(screen.getByRole("heading", { name: "Activity" })).toBeInTheDocument();
    expect(screen.getByText(/-week streak/)).toBeInTheDocument();
    expect(screen.getByText(/wins this year/)).toBeInTheDocument();
    expect(screen.getByText("Less")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();

    // One role="img" carries a text summary instead of one label per cell.
    const summary = screen.getByRole("img").getAttribute("aria-label") ?? "";
    expect(summary).toContain("3 wins"); // 2 + 1
    expect(summary).toMatch(/current streak/);
  });

  it("uses singular nouns for a single win and a one-week streak", () => {
    const data = buildActivity([{ date: "2026-06-15", count: 1 }], TODAY, 4);
    render(<ActivityHeatmap data={data} />);
    expect(screen.getByText(/win this year/)).toBeInTheDocument(); // singular, not "wins"
    const summary = screen.getByRole("img").getAttribute("aria-label") ?? "";
    expect(summary).toContain("1 win,");
    expect(summary).toContain("streak 1 week");
  });

  it("tooltips an active day with its count", () => {
    const data = buildActivity([{ date: "2026-06-15", count: 2 }], TODAY, 4);
    render(<ActivityHeatmap data={data} />);
    expect(screen.getByTitle(/2 wins on/)).toBeInTheDocument();
  });

  it("renders month labels across the window", () => {
    const data = buildActivity([], TODAY, 8); // spans late Apr → mid Jun 2026
    render(<ActivityHeatmap data={data} />);
    expect(screen.getByText("Jun")).toBeInTheDocument();
  });
});
