"use client";

import dynamic from "next/dynamic";
import { Navbar } from "@/components/Navbar";
import { ContractDashboard } from "@/components/ContractDashboard";

// Dynamic import with ssr: false for WalletContextProvider to prevent SSR window issues
const WalletContextProvider = dynamic(
  () =>
    import("@/components/WalletContextProvider").then(
      (mod) => mod.WalletContextProvider
    ),
  { ssr: false }
);

export default function Home() {
  return (
    <WalletContextProvider>
      <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <ContractDashboard />
        </main>

        <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-600">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>FundingLock Contract v1.0 • Connected to Solana Testnet</span>
            </div>
            <div className="flex items-center gap-4 text-zinc-500">
              <a
                href="https://explorer.solana.com/address/78VTWQn5FdEE3vWvincjDG5cp1J7x3s8ioZzcXEMksxx?cluster=testnet"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-300 transition"
              >
                Contract Explorer
              </a>
              <span>•</span>
              <a
                href="https://solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-300 transition"
              >
                Solana.com
              </a>
            </div>
          </div>
        </footer>
      </div>
    </WalletContextProvider>
  );
}
