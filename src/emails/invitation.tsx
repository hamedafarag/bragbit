import { Button, Heading, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout, type EmailBrand } from "./components/email-layout";

export function InvitationEmail({
  organizationName = "the workspace",
  inviterName,
  acceptUrl = "https://example.com",
  brand,
}: {
  organizationName?: string;
  inviterName?: string;
  acceptUrl?: string;
  brand?: EmailBrand;
}) {
  const accent = brand?.accent ?? "#e8590c";

  return (
    <EmailLayout brand={brand} preview={`You're invited to ${organizationName} on BragBit`}>
      <Heading
        as="h1"
        style={{ fontFamily: "Georgia, serif", fontSize: "20px", margin: "0 0 8px" }}
      >
        You&apos;re invited to {organizationName}
      </Heading>
      <Text style={{ fontSize: "14px", color: "#5d5547", margin: "0 0 18px" }}>
        {inviterName ? `${inviterName} invited you` : "You've been invited"} to keep your brag
        document on {organizationName}&apos;s BragBit. Accept to set up your account and start
        logging your wins.
      </Text>
      <Button
        href={acceptUrl}
        style={{
          backgroundColor: accent,
          color: "#ffffff",
          borderRadius: "8px",
          padding: "10px 18px",
          fontSize: "14px",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Accept invitation
      </Button>
      <Text style={{ fontSize: "12px", color: "#948a78", margin: "18px 0 0" }}>
        This invitation expires in 7 days. If you weren&apos;t expecting it, you can ignore this
        email.
      </Text>
    </EmailLayout>
  );
}

export default InvitationEmail;
