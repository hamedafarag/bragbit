import "server-only";

import { env } from "@/lib/env";
import { isHosted } from "@/lib/instance";

/**
 * A curated set of common disposable / temporary-email domains (PLAN §10 abuse
 * controls). Deliberately an embedded list rather than the fully-maintained npm
 * package — this environment can't install new dependencies — so it covers the
 * high-volume throwaway providers, not every domain; refresh it manually (or swap to
 * the package) when that's possible. Lowercased; matched against the email's domain.
 */
const DISPOSABLE_DOMAINS = new Set<string>([
  "0-mail.com",
  "0clock.net",
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "30minutemail.com",
  "33mail.com",
  "anonbox.net",
  "armyspy.com",
  "burnermail.io",
  "byom.de",
  "cuvox.de",
  "dayrep.com",
  "discard.email",
  "discardmail.com",
  "dispostable.com",
  "dropmail.me",
  "einrot.com",
  "emailfake.com",
  "emailondeck.com",
  "fakeinbox.com",
  "fakemail.net",
  "fakemailgenerator.com",
  "fastmail.fm.disposable",
  "getairmail.com",
  "getnada.com",
  "gishpuppy.com",
  "grr.la",
  "guerrillamail.biz",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "harakirimail.com",
  "incognitomail.com",
  "inboxalias.com",
  "inboxbear.com",
  "jetable.org",
  "kasmail.com",
  "maildrop.cc",
  "maileater.com",
  "mailexpire.com",
  "mailforspam.com",
  "mailinator.com",
  "mailinator.net",
  "mailinator2.com",
  "mailnesia.com",
  "mailnull.com",
  "mailsac.com",
  "mailtemp.info",
  "mintemail.com",
  "moakt.com",
  "mohmal.com",
  "mt2015.com",
  "mytemp.email",
  "mytrashmail.com",
  "no-spam.ws",
  "nowmymail.com",
  "objectmail.com",
  "onewaymail.com",
  "owlymail.com",
  "rcpt.at",
  "rhyta.com",
  "sharklasers.com",
  "shieldemail.com",
  "spam4.me",
  "spamavert.com",
  "spambog.com",
  "spambox.us",
  "spamfree24.org",
  "spamgourmet.com",
  "spamherelots.com",
  "tafmail.com",
  "teleworm.us",
  "temp-mail.org",
  "temp-mail.ru",
  "tempail.com",
  "tempinbox.com",
  "tempmail.com",
  "tempmail.net",
  "tempmailaddress.com",
  "tempmailer.com",
  "tempr.email",
  "throwawaymail.com",
  "tmail.ws",
  "tmailinator.com",
  "trashmail.com",
  "trashmail.de",
  "trashmail.net",
  "trbvm.com",
  "tyldd.com",
  "wegwerfmail.de",
  "wegwerfmail.net",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "zetmail.com",
]);

/** Whether `email`'s domain is a known disposable / temporary-email provider. */
export function isDisposableEmail(email: string): boolean {
  const domain = email.toLowerCase().trim().split("@").pop() ?? "";
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Better Auth `user.create.before` hook (PLAN §10): on the hosted instance, reject a
 * signup from a disposable-email domain when `BLOCK_DISPOSABLE_EMAIL` is on. Throwing
 * aborts account creation; the message surfaces on the signup form. No-op in the
 * private (invitation-only) modes and when the control is disabled. Required email
 * verification still applies on top of this.
 */
export async function assertSignupEmailAllowed(user: { email: string }): Promise<void> {
  if (isHosted() && env.BLOCK_DISPOSABLE_EMAIL && isDisposableEmail(user.email)) {
    throw new Error("Please sign up with a non-disposable email address.");
  }
}
