import { Heading, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout, type EmailBrand } from "./components/email-layout";

/**
 * Sent to a member when they're removed from a workspace (ENH-CO-01). A
 * portability courtesy: their full export rides along as attachments so a
 * deactivated member never loses their career record. Branded to the workspace
 * they're leaving. Default props let it render standalone in a React Email preview.
 */
export function MemberRemoved({
  workspaceName = "your workspace",
  documentCount = 1,
  fileCount = 0,
  skippedCount = 0,
  brand,
}: {
  workspaceName?: string;
  documentCount?: number;
  fileCount?: number;
  skippedCount?: number;
  brand?: EmailBrand;
}) {
  const docLabel = documentCount === 1 ? "document" : "documents";
  const fileLabel = fileCount === 1 ? "file" : "files";

  return (
    <EmailLayout brand={brand} preview={`A copy of your ${workspaceName} data`}>
      <Heading
        as="h1"
        style={{ fontFamily: "Georgia, serif", fontSize: "20px", margin: "0 0 8px" }}
      >
        A copy of your wins
      </Heading>
      <Text style={{ fontSize: "14px", color: "#5d5547", margin: "0 0 16px" }}>
        Your access to {workspaceName} on BragBit has been removed. So your record stays yours, a
        full copy of everything you logged there is attached to this email.
      </Text>
      <Text style={{ fontSize: "13.5px", color: "#5d5547", margin: "0 0 4px" }}>
        bragbit-data.json — your complete data ({documentCount} {docLabel}, every win, with links
        and tags).
      </Text>
      <Text style={{ fontSize: "13.5px", color: "#5d5547", margin: "0 0 4px" }}>
        bragbit-wins.md — the same record, as readable Markdown.
      </Text>
      {fileCount > 0 ? (
        <Text style={{ fontSize: "13.5px", color: "#5d5547", margin: "0 0 4px" }}>
          {fileCount} attachment {fileLabel} you uploaded.
        </Text>
      ) : null}
      {skippedCount > 0 ? (
        <Text style={{ fontSize: "12px", color: "#948a78", margin: "16px 0 0" }}>
          {skippedCount} larger {skippedCount === 1 ? "file was" : "files were"} too big to attach —
          each is listed by name in the JSON. Ask a {workspaceName} admin if you need the originals.
        </Text>
      ) : null}
    </EmailLayout>
  );
}

export default MemberRemoved;
