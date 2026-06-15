import { Button, Heading, Link, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout, type EmailBrand } from "./components/email-layout";

/**
 * The opt-in weekly reminder (Phase 8): a low-pressure nudge to log wins while
 * they're fresh, with a quick-add deep link and a one-click unsubscribe. Branded
 * to the recipient's workspace. Default props let it render standalone in a
 * React Email preview.
 */
export function WeeklyReminder({
  quickAddUrl = "https://example.com/dashboard",
  unsubscribeUrl = "https://example.com/unsubscribe",
  brand,
}: {
  quickAddUrl?: string;
  unsubscribeUrl?: string;
  brand?: EmailBrand;
}) {
  const accent = brand?.accent ?? "#e8590c";

  return (
    <EmailLayout brand={brand} preview="What did you ship this week?">
      <Heading
        as="h1"
        style={{ fontFamily: "Georgia, serif", fontSize: "20px", margin: "0 0 8px" }}
      >
        What did you ship this week?
      </Heading>
      <Text style={{ fontSize: "14px", color: "#5d5547", margin: "0 0 18px" }}>
        Take 30 seconds to jot down a win — a feature you shipped, a fire you put out, a teammate
        you unblocked. Future-you, writing a self-review, will thank you.
      </Text>
      <Button
        href={quickAddUrl}
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
        Log this week&apos;s wins
      </Button>
      <Text style={{ fontSize: "12px", color: "#948a78", margin: "22px 0 0" }}>
        Don&apos;t want these?{" "}
        <Link href={unsubscribeUrl} style={{ color: "#948a78", textDecoration: "underline" }}>
          Turn off weekly reminders
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}

export default WeeklyReminder;
