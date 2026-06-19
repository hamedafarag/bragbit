import { describe, expect, it } from "vitest";

import { pickFilesWithinCap } from "./offboard-bundle";

describe("pickFilesWithinCap", () => {
  it("includes files until the cap, skipping the overflow", () => {
    const files = [{ sizeBytes: 5 }, { sizeBytes: 4 }, { sizeBytes: 3 }];
    const { included, skipped } = pickFilesWithinCap(files, 10);
    expect(included).toEqual([{ sizeBytes: 5 }, { sizeBytes: 4 }]);
    expect(skipped).toEqual([{ sizeBytes: 3 }]);
  });

  it("keeps a later small file that still fits after a big one is skipped", () => {
    const files = [{ sizeBytes: 9 }, { sizeBytes: 20 }, { sizeBytes: 1 }];
    const { included, skipped } = pickFilesWithinCap(files, 10);
    expect(included).toEqual([{ sizeBytes: 9 }, { sizeBytes: 1 }]);
    expect(skipped).toEqual([{ sizeBytes: 20 }]);
  });

  it("includes everything when the total is under the cap", () => {
    const files = [{ sizeBytes: 1 }, { sizeBytes: 2 }];
    expect(pickFilesWithinCap(files, 100)).toEqual({ included: files, skipped: [] });
  });

  it("includes a file exactly at the cap boundary", () => {
    expect(pickFilesWithinCap([{ sizeBytes: 10 }], 10).included).toHaveLength(1);
  });

  it("handles an empty list", () => {
    expect(pickFilesWithinCap([], 10)).toEqual({ included: [], skipped: [] });
  });
});
