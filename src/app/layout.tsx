import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Mono — kickers, labels, numbers, meta (v2 editorial system). `font-mono` was
// already used (ScoreRing, etc.) but unwired; this maps it to JetBrains Mono.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Serif — evidence pull-quotes and testimonials, italic-only (`font-serif`).
const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "BuildWorthy",
  description: "An honest, evidence-backed verdict on your business idea.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${newsreader.variable} antialiased`}
      >
        {/* Fixed editorial backdrop — near-black base with three static radial
            glows (v2 design tokens). Non-interactive; every screen sits above
            it via the relative z-10 wrapper below. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-background bg-ambient-glow" />
        <div className="relative z-10">{children}</div>
        <Analytics />
      </body>
    </html>
  );
}
