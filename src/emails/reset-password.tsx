import { Button, Heading, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout, type EmailBrand } from "./components/email-layout";

export function ResetPasswordEmail({
  url = "https://example.com",
  brand,
}: {
  url?: string;
  brand?: EmailBrand;
}) {
  const accent = brand?.accent ?? "#e8590c";

  return (
    <EmailLayout brand={brand} preview="Reset your BragBit password">
      <Heading
        as="h1"
        style={{ fontFamily: "Georgia, serif", fontSize: "20px", margin: "0 0 8px" }}
      >
        Reset your password
      </Heading>
      <Text style={{ fontSize: "14px", color: "#5d5547", margin: "0 0 18px" }}>
        Click below to choose a new password. If you didn&apos;t request this, you can safely ignore
        this email.
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
        Reset password
      </Button>
      <Text style={{ fontSize: "12px", color: "#948a78", margin: "18px 0 0" }}>
        Or paste this link into your browser: {url}
      </Text>
    </EmailLayout>
  );
}

export default ResetPasswordEmail;
