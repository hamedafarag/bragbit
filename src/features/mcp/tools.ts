import "server-only";

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { BRAG_CATEGORY_VALUES } from "@/features/brag/schema";

import { addBragForUser, listDocumentsForUser } from "./service";

// Capture-first toolset (docs/specs/mcp-connector.md). The user's own AI applies
// the BragBit formula as it drafts — BragBit ships no AI itself. Tenant isolation
// is handled in the service layer (every call scoped to the token's user).
const FORMULA =
  "Write it with the BragBit formula: what you did + why it mattered + the measurable result.";

/** Pull the authenticated user id the MCP handler stashed on the token's AuthInfo. */
function userIdFrom(extra: { authInfo?: AuthInfo }): string {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== "string") throw new Error("Not authorized.");
  return userId;
}

/** Register the MCP tools on a per-request server instance. */
export function registerMcpTools(server: McpServer): void {
  server.tool(
    "bragbit_add_brag",
    `Record a professional win ("brag") in the user's BragBit timeline. ${FORMULA} ` +
      "Put the accomplishment in `title`, the measurable outcome in `impact`, and any extra " +
      "detail in `description`. Without a `documentId` it lands in the user's most recent document.",
    {
      title: z.string().min(1).max(300).describe("The accomplishment as a concise headline."),
      impact: z
        .string()
        .max(1000)
        .optional()
        .describe("Why it mattered + the measurable result (numbers, %, time/money saved)."),
      description: z.string().max(5000).optional().describe("Optional extra detail, in Markdown."),
      category: z
        .enum(BRAG_CATEGORY_VALUES)
        .optional()
        .describe("One of BragBit's fixed categories, if one clearly fits."),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("ISO date (YYYY-MM-DD) the win happened. Defaults to today."),
      documentId: z
        .string()
        .optional()
        .describe("Target document id (from bragbit_list_documents). Defaults to the most recent."),
      links: z
        .array(z.object({ url: z.url(), label: z.string().max(200).optional() }))
        .max(20)
        .optional()
        .describe("Supporting links — PRs, docs, dashboards."),
    },
    async (args, extra) => {
      const userId = userIdFrom(extra);
      const result = await addBragForUser(userId, args);
      if (!result.ok) {
        return { content: [{ type: "text" as const, text: result.error }], isError: true };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Logged “${args.title}” to “${result.documentTitle}”. View it: ${result.url}`,
          },
        ],
      };
    },
  );

  server.tool(
    "bragbit_list_documents",
    "List the user's BragBit documents (review periods) so you can choose where a brag belongs. " +
      "Returns each document's title, id, and workspace.",
    async (extra) => {
      const userId = userIdFrom(extra);
      const docs = await listDocumentsForUser(userId);
      if (docs.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "You don't have any documents yet. Create one in BragBit first.",
            },
          ],
        };
      }
      const lines = docs.map((d) => `- ${d.title} (id: ${d.id}) — ${d.workspaceName}`).join("\n");
      return { content: [{ type: "text" as const, text: `Your documents:\n${lines}` }] };
    },
  );
}
