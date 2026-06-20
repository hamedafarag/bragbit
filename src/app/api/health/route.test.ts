// Unit tests for the /api/health route handler (ENH-INFRA-03). The db is mocked so
// both branches run without a database: a resolving `select 1` → 200 {status:"ok"},
// a rejecting one → 503 {status:"error"}.
import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { execute } }));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    execute.mockReset();
  });

  it("returns 200 { status: 'ok' } when the database responds", async () => {
    execute.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("returns 503 { status: 'error' } when the database query throws", async () => {
    execute.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ status: "error" });
  });
});
