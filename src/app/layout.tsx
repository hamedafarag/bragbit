import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { connection } from "next/server";
import "./globals.css";

import { ThemeInit } from "@/components/shared/theme-init";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";
import { THEME_COOKIE, themeClass } from "@/lib/theme";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const description = "Your promotion evidence, on your own Postgres.";

// `opengraph-image.png` and the `icon`/`apple-icon` files in this segment are
// picked up by Next's metadata file conventions; `metadataBase` (from APP_URL)
// resolves them to absolute URLs for link unfurls.
export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  applicationName: "BragBit",
  title: "BragBit",
  description,
  openGraph: {
    type: "website",
    siteName: "BragBit",
    title: "BragBit",
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "BragBit",
    description,
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The CSP nonce (src/proxy.ts) requires dynamic rendering so each render gets a fresh
  // one; opt the whole tree in here. Next then applies the per-request nonce to its own
  // scripts automatically (ENH-SEC-01). The app is already request-dynamic — this also
  // covers the otherwise-static not-found page so its scripts aren't CSP-blocked.
  await connection();
  const cookieStore = await cookies();
  // Dark mode (ENH-UX-01): the cookie drives the SSR class for no-flash on return
  // visits; ThemeInit applies the OS preference on a first visit. suppressHydration
  // Warning because the toggle/ThemeInit mutate the <html> class on the client.
  const theme = themeClass(cookieStore.get(THEME_COOKIE)?.value);
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} ${theme} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeInit />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
