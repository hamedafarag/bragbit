// DB-free unit test for emailRemovedMemberBundle — the portability email a removed
// member gets (ENH-CO-01). The data loader, db (workspace brand), storage, and the
// mailer are mocked; the pure assemblers (JSON shaper, Markdown, brand, file picker)
// run for real, so this verifies the bundle wiring end to end without a database.
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAllData = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());
const storageGet = vi.hoisted(() => vi.fn());

vi.mock("@/features/export/queries", () => ({ getAllDataForExport: getAllData }));
vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("@/lib/storage", () => ({ getStorage: () => ({ get: storageGet }) }));

function makeChain(result: unknown): unknown {
  const p = Promise.resolve(result);
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return p.then.bind(p);
        if (prop === "catch") return p.catch.bind(p);
        if (prop === "finally") return p.finally.bind(p);
        return () => makeChain(result);
      },
    },
  );
}
vi.mock("@/lib/db", () => ({
  db: { select: () => makeChain([{ name: "Acme", accentColor: null, logoKey: null }]) },
}));

import { emailRemovedMemberBundle } from "./offboard";

type Att = { storageKey: string; fileName: string; mimeType: string; sizeBytes: number };

function loaded(attachments: Att[]) {
  const brag = {
    id: "br1",
    documentId: "doc1",
    title: "Win",
    descriptionMd: "did the thing",
    impactMd: "impact",
    date: "2026-03-15",
    category: "shipped-work",
    status: "shipped",
    visibility: "shared",
    collaborators: null,
    attribution: null,
    createdAt: new Date("2026-03-15"),
    updatedAt: new Date("2026-03-15"),
    links: [],
    tags: [],
    attachments: attachments.map((a, i) => ({
      id: `a${i}`,
      bragId: "br1",
      createdAt: new Date(),
      ...a,
    })),
  };
  return {
    workspace: { name: "Acme", type: "organization" },
    account: { email: "ada@x.com", displayName: "Ada" },
    documents: [
      {
        document: {
          id: "doc1",
          workspaceId: "ws1",
          userId: "u1",
          title: "2026",
          description: null,
          periodStart: null,
          periodEnd: null,
          goalsMd: null,
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        brags: [brag],
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const FILE: Att = {
  storageKey: "ws1/attachments/a1.pdf",
  fileName: "a.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1000,
};
const scope = { workspaceId: "ws1", userId: "u1", email: "ada@x.com" };

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(undefined);
  storageGet.mockReset();
  getAllData.mockReset();
});

describe("emailRemovedMemberBundle", () => {
  it("emails JSON + Markdown + the within-cap attachment files", async () => {
    getAllData.mockResolvedValue(loaded([FILE]));
    storageGet.mockResolvedValue(Buffer.from("filebytes"));

    await emailRemovedMemberBundle(scope);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = sendEmail.mock.calls[0]![0] as {
      to: string;
      subject: string;
      attachments: { filename: string }[];
    };
    expect(arg.to).toBe("ada@x.com");
    expect(arg.subject).toContain("Acme");
    const names = arg.attachments.map((a) => a.filename);
    expect(names).toContain("bragbit-data.json");
    expect(names).toContain("bragbit-wins.md");
    expect(arg.attachments).toHaveLength(3); // json + markdown + the one file
    expect(storageGet).toHaveBeenCalledWith("ws1/attachments/a1.pdf");
  });

  it("skips a file whose object is missing, still sending JSON + Markdown", async () => {
    getAllData.mockResolvedValue(loaded([FILE]));
    storageGet.mockRejectedValue(new Error("gone"));

    await emailRemovedMemberBundle(scope);
    const arg = sendEmail.mock.calls[0]![0] as { attachments: unknown[] };
    expect(arg.attachments).toHaveLength(2);
  });

  it("handles a member with no attachments", async () => {
    getAllData.mockResolvedValue(loaded([]));

    await emailRemovedMemberBundle(scope);
    const arg = sendEmail.mock.calls[0]![0] as { attachments: unknown[] };
    expect(arg.attachments).toHaveLength(2);
    expect(storageGet).not.toHaveBeenCalled();
  });
});
