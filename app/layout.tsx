import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Self-hosted via next/font: the font files are served from our own domain and
// preloaded, so there are no render-blocking requests to Google on each visit.
// Each exposes a CSS variable that tokens.css feeds into --font-sans/--font-serif.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});
import { UserDataProvider } from "@/lib/userData";
import FeedbackButton from "./components/FeedbackButton";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "Chorus Life — Digital Retirement Coaching",
  description: "Digital retirement coaching from Chorus Life.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${sourceSerif.variable}`}>
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <UserDataProvider>{children}</UserDataProvider>
          {/* Global in-app feedback panel — fixed bottom-right on every screen. */}
          <FeedbackButton />
        </ClerkProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}