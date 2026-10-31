import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

/**
 * Mobile viewport configuration for smartphone accessibility (320px-430px)
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

/**
 * Metadata configuration for HarvestLink Finance
 * Optimized for SEO and platform identity
 */
export const metadata: Metadata = {
  title: "HarvestLink Finance — Nigerian Agricultural Supply-Chain Finance Platform",
  description:
    "End-to-end supply chain financing platform connecting Nigerian agricultural suppliers, buyers, and financing partners with verifiable milestone tracking.",
  keywords: [
    "Agriculture Nigeria",
    "Supply Chain Finance",
    "Purchase Order Financing",
    "Agri-Fintech",
    "Maize",
    "Soya",
    "Cashew",
    "Commodity Aggregation",
    "HarvestLink",
  ],
};

/**
 * Root Layout Component
 * Wraps every page with the top navbar and responsive footer
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
        {/* Universal Navigation Header */}
        <Navbar />

        {/* Dynamic Page Content */}
        <main className="flex-1">{children}</main>

        {/* Global Footer */}
        <Footer />
      </body>
    </html>
  );
}
