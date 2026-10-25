import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./workspace.css";

const fontSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const fontMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FundingLock — Make funding predictable.",
    template: "%s | FundingLock",
  },
  description:
    "Turn variable perpetual funding into a fixed rate. Explore funding-rate hedges, simulate your position, and connect with counterparties on Solana Testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${fontSans.variable} ${fontMono.variable} h-full font-sans`}
    >
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
