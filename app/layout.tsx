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
import MobileAppBar from "./components/MobileAppBar";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "Chorus Life — Your retirement coach",
  description: "Your retirement coach from Chorus Life.",
  // The app domain stays out of search during the pilot (invite-only; the public
  // front door is chorus-life.com). Inherited by every page unless overridden.
  robots: { index: false, follow: false },
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
          <UserDataProvider>
            {/* Mobile-only sticky nav backbone (≤880px). display:none on desktop,
                so the desktop chrome (ProviderBand / session nav bar) is unchanged. */}
            <MobileAppBar />
            {children}
          </UserDataProvider>
          {/* Global in-app feedback panel — fixed bottom-right on desktop; hidden
              on mobile, where it's folded into the app bar's Menu. */}
          <FeedbackButton />
        </ClerkProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}