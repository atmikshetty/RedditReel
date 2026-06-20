import type { Metadata, Viewport } from "next";
import type { JSX, ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "RedditReel",
  description: "Turn Reddit scripts into story card reels with TTS and game footage.",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
