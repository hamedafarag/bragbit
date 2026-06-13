import { Button, Heading, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout, type EmailBrand } from "./components/email-layout";

/**
 * First concrete template (used by Phase 1 email verification). Doubles as the
 * pattern for invitation / password-reset / reminder emails. Default props let
 * it render standalone in a React Email preview.
 */
export function VerifyEmail({
  url = "https://example.com",
  brand,
}: {
  url?: string;
  brand?: EmailBrand;
}) {
  const accent = brand?.accent ?? "#e8590c";

  return (
    <EmailLayout brand={brand} preview="Verify your email to start logging wins">
      <Heading
        as="h1"
        style={{ fontFamily: "Georgia, serif", fontSize: "20px", margin: "0 0 8px" }}
      >
        Verify your email
      </Heading>
      <Text style={{ fontSize: "14px", color: "#5d5547", margin: "0 0 18px" }}>
        Confirm this address to finish setting up your BragBit account and start logging wins.
      </Text>
      <Button
        href={url}
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
        Verify email
      </Button>
      <Text style={{ fontSize: "12px", color: "#948a78", margin: "18px 0 0" }}>
        Or paste this link into your browser: {url}
      </Text>
    </EmailLayout>
  );
}

export default VerifyEmail;
