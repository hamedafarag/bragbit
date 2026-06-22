// Unit tests for the external-cron reminder route. The CRON_SECRET (via env) and the
// send engine are mocked, so the 503 (unconfigured) / 401 (bad bearer) / 200 (sends)
// branches run in isolation. DB-free.
import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({ CRON_SECRET: "topsecret" as string }));
const sendDue = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("@/features/reminder/send", () => ({ sendDueReminders: sendDue }));

import { POST } from "./route";

function post(authorization?: string) {
  return POST(
    new Request("http://localhost/api/cron/reminders", {
      method: "POST",
      headers: authorization ? { authorization } : undefined,
    }),
  );
}

beforeEach(() => {
  envMock.CRON_SECRET = "topsecret";
  sendDue.mockReset();
  sendDue.mockResolvedValue({ sent: 3 });
});

describe("POST /api/cron/reminders", () => {
  it("503s when CRON_SECRET is not configured", async () => {
    envMock.CRON_SECRET = "";
    const res = await post("Bearer topsecret");
    expect(res.status).toBe(503);
    expect(sendDue).not.toHaveBeenCalled();
  });

  it("401s a missing Authorization header", async () => {
    expect((await post()).status).toBe(401);
    expect(sendDue).not.toHaveBeenCalled();
  });

  it("401s a wrong secret", async () => {
    const res = await post("Bearer wrongsecret");
    expect(res.status).toBe(401);
    expect(sendDue).not.toHaveBeenCalled();
  });

  it("sends due reminders with the correct bearer secret", async () => {
    const res = await post("Bearer topsecret");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, sent: 3 });
    expect(sendDue).toHaveBeenCalledTimes(1);
  });

  it("accepts a case-insensitive bearer scheme", async () => {
    const res = await post("bearer topsecret");
    expect(res.status).toBe(200);
    expect(sendDue).toHaveBeenCalledTimes(1);
  });
});
