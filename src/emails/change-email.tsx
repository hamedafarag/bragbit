import { Button, Heading, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout, type EmailBrand } from "./components/email-layout";

/**
 * Sent to a user's CURRENT (verified) address when they request an email change.
 * The change only applies after they confirm from the inbox they already
 * control — so a stolen session can't silently move the account to an attacker's
 * address.
 */
export function ChangeEmailConfirmation({
  url = "https://example.com",
  newEmail = "new@example.com",
  brand,
}: {
  url?: string;
  newEmail?: string;
  brand?: EmailBrand;
}) {
  const accent = brand?.accent ?? "#e8590c";

  return (
    <EmailLayout brand={brand} preview="Confirm your new BragBit email address">
      <Heading
        as="h1"
        style={{ fontFamily: "Georgia, serif", fontSize: "20px", margin: "0 0 8px" }}
      >
        Confirm your new email
      </Heading>
      <Text style={{ fontSize: "14px", color: "#5d5547", margin: "0 0 18px" }}>
        You asked to change your BragBit email to <strong>{newEmail}</strong>. Confirm from this
        inbox to apply the change. If you didn&apos;t request this, ignore this email — your address
        stays the same.
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
        Confirm new email
      </Button>
      <Text style={{ fontSize: "12px", color: "#948a78", margin: "18px 0 0" }}>
        Or paste this link into your browser: {url}
      </Text>
    </EmailLayout>
  );
}

export default ChangeEmailConfirmation;
