import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree, IBM_Plex_Mono } from "next/font/google";
import { ViewTransitions } from "next-view-transitions";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

/* Font pairing and roles: docs/design-direction.md §4.
   One typeface per function, no font doing two jobs. Bricolage carries
   headlines, Figtree carries UI and body, Plex Mono carries streaming
   numbers and raw payloads. The --font-sans/serif/mono aliases keep
   their names so existing components keep working. */

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Whitespace: before you ship, find out who it is actually for",
  description:
    "Whitespace tells you which audience your idea fits, how strongly, and where to find those people.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <ViewTransitions>
      <html
        lang="en"
        className={`${figtree.variable} ${bricolage.variable} ${plexMono.variable} h-full`}
      >
        <body className="flex min-h-full flex-col font-sans text-ink antialiased">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:text-ink"
          >
            Skip to content
          </a>
          <SiteHeader />
          {children}
        </body>
      </html>
    </ViewTransitions>
  );
}
