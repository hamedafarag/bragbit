import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

/**
 * Workspace-brandable base layout for all BragBit emails. Pass the active
 * workspace's branding; it falls back to the BragBit defaults. Web fonts don't
 * load in email clients, so we use system serif/sans stacks.
 */
export type EmailBrand = {
  name?: string;
  logoUrl?: string;
  accent?: string;
};

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function EmailLayout({
  brand,
  preview,
  children,
}: {
  brand?: EmailBrand;
  preview?: string;
  children: React.ReactNode;
}) {
  const name = brand?.name ?? "BragBit";
  const accent = brand?.accent ?? "#e8590c";

  return (
    <Html>
      <Head />
      {preview ? <Preview>{preview}</Preview> : null}
      <Body
        style={{
          backgroundColor: "#f6f2e9",
          color: "#221d16",
          fontFamily: SANS,
          margin: 0,
          padding: "24px 12px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#fffdf7",
            border: "1px solid #ddd5c4",
            borderRadius: "12px",
            maxWidth: "520px",
            margin: "0 auto",
            padding: "28px 32px",
          }}
        >
          <Section>
            {brand?.logoUrl ? (
              <Img src={brand.logoUrl} alt={name} height="28" />
            ) : (
              <Text
                style={{
                  fontFamily: SERIF,
                  fontWeight: 600,
                  fontSize: "18px",
                  color: accent,
                  margin: 0,
                }}
              >
                {name}
              </Text>
            )}
          </Section>

          <Hr style={{ borderColor: "#e8e1d1", margin: "18px 0" }} />

          {children}

          <Hr style={{ borderColor: "#e8e1d1", margin: "24px 0 14px" }} />
          <Text style={{ fontSize: "11px", color: "#948a78", margin: 0 }}>
            Sent by {name} · Powered by BragBit
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default EmailLayout;
