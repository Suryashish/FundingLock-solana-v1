"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  BINANCE_SOL_CONFIG,
  ContractTerms,
  FundingObservation,
  PositionSide,
} from "../lib/domain/types.ts";
import {
  buildCashFlowComparison,
  formatCurrency,
  formatRatePercent,
} from "../lib/domain/funding.ts";
import {
  DEMO_SCENARIOS,
  FIXTURE_START_TIME,
  INTERVAL_SECONDS,
} from "../lib/data/fixtures.ts";
import {
  RotateCcw,
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  CreditCard,
  Users,
  Repeat,
  TrendingUp,
  Clock,
} from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { TransactionInstruction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  buildCreateOfferIx,
  buildInitializeMarketIx,
} from "../lib/solana/client.ts";
import {
  createContractId,
  fetchContractAccount,
  fetchMarketConfig,
  formatSignature,
  simulateAndSendTransaction,
  type OnChainContractState,
  type OnChainMarketConfig,
} from "../lib/solana/transactions.ts";
import {
  CryptoHubIllustration,
  SatelliteIllustration,
  LayeredCubesIllustration,
} from "./BlockeyIllustrations.tsx";
import { NavTab } from "./SideNavbar.tsx";

interface HedgeSimulatorProps {
  customObservations?: FundingObservation[] | null;
  onNavigateTab?: (tab: NavTab) => void;
}

export const HedgeSimulator: React.FC<HedgeSimulatorProps> = ({
  customObservations,
  onNavigateTab,
}) => {
  const [positionSide, setPositionSide] = useState<PositionSide>("long");
  const [notionalDollars, setNotionalDollars] = useState<number>(10000);
  const [fixedRatePercent, setFixedRatePercent] = useState<number>(0.02);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("baseline");
  const [showLedger, setShowLedger] = useState<boolean>(false);

  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [marketConfig, setMarketConfig] = useState<OnChainMarketConfig | null>(null);
  const [onChainContract, setOnChainContract] = useState<OnChainContractState | null>(null);
  const [chainAction, setChainAction] = useState<{
    state: "idle" | "pending" | "success" | "error";
    message: string;
  }>({ state: "idle", message: "" });

  // Real-time epoch countdown
  const [countdown, setCountdown] = useState<string>("00h 00m 00s");

  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const currentUtcHours = now.getUTCHours();
      const currentUtcMinutes = now.getUTCMinutes();
      const currentUtcSeconds = now.getUTCSeconds();

      let nextEpochHour = 8;
      if (currentUtcHours >= 16) {
        nextEpochHour = 24;
      } else if (currentUtcHours >= 8) {
        nextEpochHour = 16;
      }

      const totalCurrentSeconds =
        currentUtcHours * 3600 + currentUtcMinutes * 60 + currentUtcSeconds;
      const targetSeconds = nextEpochHour * 3600;
      const remaining = targetSeconds - totalCurrentSeconds;

      const hrs = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      const secs = remaining % 60;

      const pad = (n: number) => n.toString().padStart(2, "0");
      setCountdown(`${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch balance
  useEffect(() => {
    if (!wallet.publicKey || !wallet.connected) {
      return;
    }
    let active = true;
    connection.getBalance(wallet.publicKey, "confirmed")
      .then((bal) => {
        if (active) setWalletBalance(Number(bal) / Number(LAMPORTS_PER_SOL));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [wallet.connected, wallet.publicKey, connection]);

  // Active observations
  const activeObservations = useMemo(() => {
    if (customObservations && customObservations.length > 0) {
      return customObservations.slice(0, 21);
    }
    const scenario = DEMO_SCENARIOS[selectedScenarioId] || DEMO_SCENARIOS.baseline;
    return scenario.observations;
  }, [customObservations, selectedScenarioId]);

  // Construct active contract terms
  const terms: ContractTerms = useMemo(() => {
    const fixedRatePpm = Math.round(fixedRatePercent * 10000);
    return {
      contractId: "SIM-SOL-001",
      marketSymbol: "SOL-PERP",
      venueId: "BINANCE_PERP",
      positionSide,
      notionalCents: Math.round(notionalDollars * 100),
      fixedRatePpm,
      intervalCount: activeObservations.length || 21,
      intervalSeconds: INTERVAL_SECONDS,
      startTime: FIXTURE_START_TIME,
      endTime: FIXTURE_START_TIME + (activeObservations.length || 21) * INTERVAL_SECONDS,
      minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
      maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
      collateralMint: "SOL",
    };
  }, [positionSide, notionalDollars, fixedRatePercent, activeObservations.length]);

  // Pure domain calculation
  const explanation = useMemo(() => {
    return buildCashFlowComparison(terms, activeObservations, BINANCE_SOL_CONFIG);
  }, [terms, activeObservations]);

  useEffect(() => {
    let active = true;
    fetchMarketConfig(connection)
      .then((config) => {
        if (active) setMarketConfig(config);
      })
      .catch(() => {
        if (active) setMarketConfig(null);
      });
    return () => {
      active = false;
    };
  }, [connection]);

  const handleCreateOfferOnChain = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      setChainAction({
        state: "error",
        message: "Wallet not connected. Opening wallet selector...",
      });
      setVisible(true);
      return;
    }
    if (positionSide !== "long") {
      setChainAction({
        state: "error",
        message: "The deployed Testnet contract currently supports long offers only.",
      });
      return;
    }

    setChainAction({ state: "pending", message: "Verifying Testnet balance and preparing transaction…" });
    try {
      const lamports = await connection.getBalance(wallet.publicKey, "confirmed");
      if (lamports < 5_000_000) {
        throw new Error(
          `Insufficient Testnet SOL (balance: ${(lamports / 1e9).toFixed(4)} SOL). Need ~0.005 SOL for fees. Fund at https://faucet.solana.com.`
        );
      }

      const config = marketConfig ?? (await fetchMarketConfig(connection));
      const instructions: TransactionInstruction[] = [];

      if (!config) {
        instructions.push(
          buildInitializeMarketIx({
            venueId: BINANCE_SOL_CONFIG.venueId,
            marketSymbol: BINANCE_SOL_CONFIG.marketSymbol,
            intervalSeconds: BINANCE_SOL_CONFIG.intervalSeconds,
            minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
            maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
            maxNotionalCents: BINANCE_SOL_CONFIG.maxNotionalCents,
            safetyBufferBps: BINANCE_SOL_CONFIG.safetyBufferBps,
            oracleAuthority: wallet.publicKey,
            admin: wallet.publicKey,
          })
        );
      } else if (config.isPaused) {
        throw new Error("The on-chain SOL-PERP market is currently paused.");
      }

      const contractId = createContractId("SIM", wallet.publicKey);
      instructions.push(
        buildCreateOfferIx({
          contractId,
          marketSymbol: BINANCE_SOL_CONFIG.marketSymbol,
          buyer: wallet.publicKey,
          positionSide,
          notionalCents: terms.notionalCents,
          fixedRatePpm: terms.fixedRatePpm,
          intervalCount: terms.intervalCount,
          startTime: Math.floor(Date.now() / 1000),
        })
      );

      setChainAction({
        state: "pending",
        message: "Awaiting wallet approval… Please approve the transaction in your wallet prompt.",
      });

      const signature = await simulateAndSendTransaction({
        connection,
        wallet,
        description: config ? "Create offer" : "Initialize market & create offer",
        instructions,
      });

      const updatedConfig = await fetchMarketConfig(connection);
      if (updatedConfig) setMarketConfig(updatedConfig);

      const account = await fetchContractAccount(connection, contractId);
      setOnChainContract(account);
      setChainAction({
        state: "success",
        message: `Offer ${contractId} created on Testnet! Tx: ${formatSignature(signature)}.`,
      });
    } catch (error) {
      setChainAction({
        state: "error",
        message: error instanceof Error ? error.message : "Offer creation failed.",
      });
    }
  };

  const resetToDocumentedBaseline = () => {
    setPositionSide("long");
    setNotionalDollars(10000);
    setFixedRatePercent(0.02);
    setSelectedScenarioId("baseline");
    setChainAction({ state: "idle", message: "" });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 font-sans">
      {/* 1. Profile Account Header (Exact match to Screen 2) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-black/5 dark:ring-white/5">
            {wallet.connected && wallet.publicKey ? (
              wallet.publicKey.toBase58().slice(0, 2).toUpperCase()
            ) : (
              <span className="text-base font-extrabold">■</span>
            )}
          </div>
          <div>
            <span className="text-xs text-zinc-400 font-medium block">Personal account</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-zinc-950 dark:text-white">
                {wallet.connected && wallet.publicKey
                  ? `${wallet.publicKey.toBase58().slice(0, 6)}...${wallet.publicKey.toBase58().slice(-4)}`
                  : "Solana Testnet Trader"}
              </span>
              {walletBalance !== null && (
                <span className="text-xs font-mono text-zinc-400">
                  ({walletBalance.toFixed(2)} SOL)
                </span>
              )}
              <span className="w-1.5 h-1.5 rounded-full bg-[#74f89d]" />
            </div>
          </div>
        </div>

        {/* Top Segmented Navigation Capsule Bar (Exact match to Screen 2!) */}
        <div className="p-1 rounded-full bg-[#0a0a0a] text-white flex items-center gap-1 shadow-md self-start sm:self-center font-mono text-xs">
          <button
            type="button"
            onClick={() => onNavigateTab?.("simulator")}
            className="bg-white text-zinc-950 font-bold px-4 py-1.5 rounded-full shadow-xs transition"
          >
            Simulator
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab?.("marketplace")}
            className="text-zinc-400 hover:text-white font-medium px-4 py-1.5 rounded-full transition"
          >
            Marketplace
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab?.("replay")}
            className="text-zinc-400 hover:text-white font-medium px-4 py-1.5 rounded-full transition"
          >
            Contract Flow
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab?.("historical")}
            className="text-zinc-400 hover:text-white font-medium px-4 py-1.5 rounded-full transition hidden sm:inline-block"
          >
            30D Rates
          </button>
        </div>
      </div>

      {/* 2. Main Two-Column Viewport (Left = Screen 2 Dashboard, Right = Screen 3 Feature Hub) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Screen 2 Replication (Cards, 2x2 Grid, Split Blocks, Balances) */}
        <div className="lg:col-span-7 space-y-5">
          {/* A. "My position exposure" / "My balance" Card (Screen 2) */}
          <div className="p-6 rounded-[28px] bg-white dark:bg-[#121316] border border-black/[0.1] dark:border-white/[0.1] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-mono">
                My position exposure
              </span>
              <div className="flex items-center gap-1 text-zinc-300 dark:text-zinc-600">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-white" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              </div>
            </div>

            <div className="flex items-baseline justify-between">
              <div className="text-4xl sm:text-5xl font-extrabold text-zinc-950 dark:text-white tracking-tight font-mono">
                ${notionalDollars.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <span className="px-3.5 py-1 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-mono font-bold">
                USD
              </span>
            </div>

            <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
              <span className="text-zinc-500">
                Fixed Target Rate: <strong className="text-zinc-900 dark:text-white">{fixedRatePercent > 0 ? `+${fixedRatePercent.toFixed(4)}%` : `${fixedRatePercent.toFixed(4)}%`}</strong> / 8h
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Net Target Cost: {formatCurrency(explanation.netFundingCostCents)}
              </span>
            </div>
          </div>

          {/* B. 2x2 Jet Black Quick Actions Grid (Screen 2: Buy with Card / P2P / Auto / Earn) */}
          <div className="p-4 rounded-[28px] bg-[#0a0a0a] text-white shadow-md">
            <div className="grid grid-cols-2 gap-px bg-zinc-800/60 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setNotionalDollars(10000)}
                className="p-3.5 bg-[#0a0a0a] hover:bg-zinc-900 flex items-center gap-3 transition text-left group"
              >
                <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 group-hover:text-white">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-100">$10k Baseline</div>
                  <div className="text-[10px] text-zinc-400">1-Click Sizing</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab?.("marketplace")}
                className="p-3.5 bg-[#0a0a0a] hover:bg-zinc-900 flex items-center gap-3 transition text-left group"
              >
                <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 group-hover:text-white">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-100">P2P Trading</div>
                  <div className="text-[10px] text-zinc-400">Order Board</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab?.("replay")}
                className="p-3.5 bg-[#0a0a0a] hover:bg-zinc-900 flex items-center gap-3 transition text-left group"
              >
                <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 group-hover:text-white">
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-100">Auto-Replay</div>
                  <div className="text-[10px] text-zinc-400">6-Step Flow</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab?.("historical")}
                className="p-3.5 bg-[#0a0a0a] hover:bg-zinc-900 flex items-center gap-3 transition text-left group"
              >
                <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 group-hover:text-white">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-100">Seeking Earn</div>
                  <div className="text-[10px] text-zinc-400">30D Analytics</div>
                </div>
              </button>
            </div>
          </div>

          {/* C. The Signature Dual Action Split Blocks (Screen 2: Deposit / Withdraw style!) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left Block: Jet Black Deposit & Long Hedge */}
            <div
              onClick={() => setPositionSide("long")}
              className={`p-5 rounded-[26px] bg-[#0a0a0a] text-white cursor-pointer hover:bg-zinc-900 transition flex flex-col justify-between h-32 select-none ring-2 ${
                positionSide === "long" ? "ring-[#74f89d] shadow-md" : "ring-transparent opacity-85"
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold leading-tight">Long Hedge</div>
                <div className="text-[11px] text-zinc-400 leading-tight">Deposit Escrow & Lock</div>
              </div>
            </div>

            {/* Right Block: Vibrant Mint Green #74f89d Withdraw & Short Hedge */}
            <div
              onClick={() => setPositionSide("short")}
              className={`p-5 rounded-[26px] bg-[#74f89d] text-zinc-950 cursor-pointer hover:bg-[#5df68b] transition flex flex-col justify-between h-32 select-none ring-2 shadow-sm ${
                positionSide === "short" ? "ring-zinc-950 shadow-md" : "ring-transparent opacity-90"
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-black/10 flex items-center justify-center text-zinc-950">
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <div className="text-sm font-extrabold leading-tight">Short Hedge</div>
                <div className="text-[11px] text-zinc-800 font-medium leading-tight">Offset Short Basis</div>
              </div>
            </div>
          </div>

          {/* D. Interactive Slider & Rate Controls */}
          <div className="p-5 rounded-[28px] bg-white dark:bg-[#121316] border border-black/[0.1] dark:border-white/[0.1] shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
              <span className="text-xs font-mono font-bold text-zinc-950 dark:text-white uppercase">
                Hedge Parameters
              </span>
              <button
                type="button"
                onClick={resetToDocumentedBaseline}
                className="text-[11px] font-mono text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset ($42 Net)</span>
              </button>
            </div>

            {/* Notional Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-zinc-500">Notional Size</span>
                <span className="font-bold text-zinc-950 dark:text-white">
                  ${notionalDollars.toLocaleString()} USD
                </span>
              </div>
              <input
                type="range"
                min="500"
                max="50000"
                step="500"
                value={notionalDollars}
                onChange={(e) => setNotionalDollars(Number(e.target.value))}
                className="w-full accent-zinc-950 dark:accent-white h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full appearance-none cursor-pointer"
              />
              <div className="flex items-center gap-1.5 pt-1">
                {[1000, 5000, 10000, 25000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setNotionalDollars(amt)}
                    className={`flex-1 py-1 rounded-full text-[11px] font-mono font-semibold transition ${
                      notionalDollars === amt
                        ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    ${amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Rate */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-zinc-500">Target Fixed Rate</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {fixedRatePercent > 0 ? `+${fixedRatePercent.toFixed(4)}%` : `${fixedRatePercent.toFixed(4)}%`} / 8h
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { label: "+0.01%", val: 0.01 },
                  { label: "+0.02%", val: 0.02 },
                  { label: "+0.05%", val: 0.05 },
                  { label: "-0.02%", val: -0.02 },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setFixedRatePercent(chip.val)}
                    className={`flex-1 py-1 rounded-full text-[11px] font-mono font-semibold transition ${
                      Math.abs(fixedRatePercent - chip.val) < 0.0001
                        ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* E. Balances List (Screen 2: B BTC, E ETH, U USDT, A ADA style!) */}
          <div className="p-5 rounded-[28px] bg-white dark:bg-[#121316] border border-black/[0.1] dark:border-white/[0.1] shadow-sm space-y-3 font-mono">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                Balances
              </span>
              <div className="flex items-center gap-1 text-zinc-300 dark:text-zinc-600">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-white" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              </div>
            </div>

            <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {/* Row 1: SOL Collateral Vault */}
              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
                    ◎
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-950 dark:text-white">SOL</div>
                    <div className="text-[10px] text-zinc-400">Escrow Collateral</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-zinc-950 dark:text-white">
                    {((explanation.requiredCollateralBuyerCents + explanation.requiredCollateralRiskTakerCents) / 10000).toFixed(4)}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {formatCurrency(explanation.requiredCollateralBuyerCents + explanation.requiredCollateralRiskTakerCents)}
                  </div>
                </div>
              </div>

              {/* Row 2: Binance 8H Epoch */}
              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#74f89d] text-zinc-950 flex items-center justify-center font-bold text-xs">
                    ⚡
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-950 dark:text-white">SOL-PERP</div>
                    <div className="text-[10px] text-zinc-400">8h Realized Rate</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+0.0200%</div>
                  <div className="text-[10px] text-zinc-400 flex items-center gap-1 justify-end">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{countdown}</span>
                  </div>
                </div>
              </div>

              {/* Row 3: Net Offset Settlement Credit */}
              <div className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
                    $
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-950 dark:text-white">NET OFFSET</div>
                    <div className="text-[10px] text-zinc-400">Maturity Settlement</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(explanation.totalSettlementCents, true)}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">100% Solvency</div>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Action Button (Screen 1 & 2 CTA Style: Full Width Black Capsule) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleCreateOfferOnChain}
              disabled={chainAction.state === "pending"}
              className="w-full py-4 rounded-full bg-zinc-950 dark:bg-white hover:bg-zinc-900 text-white dark:text-zinc-950 text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-2 shadow-md transition active:scale-98 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>
                {chainAction.state === "pending"
                  ? "Awaiting Wallet Approval…"
                  : wallet.connected
                  ? "Lock Rate on Solana Testnet"
                  : "Connect Wallet to Lock Rate"}
              </span>
            </button>

            {onChainContract && (
              <div className="text-center text-[11px] font-mono text-zinc-500 pt-2">
                Created: <strong className="text-zinc-900 dark:text-zinc-100">{onChainContract.contractId}</strong> · State: <span className="text-[#74f89d] font-bold">{onChainContract.lifecycleLabel}</span>
              </div>
            )}

            {chainAction.message && (
              <p
                className={`text-center text-[11px] font-mono pt-2 ${
                  chainAction.state === "error"
                    ? "text-amber-600 dark:text-amber-400"
                    : chainAction.state === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-500"
                }`}
              >
                {chainAction.message}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Screen 3 Feature Hub Replication (3 Sculpted Cards Stack) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Feature Card 1: Your's hedge hub (White card with technical illustration) */}
          <div className="p-6 rounded-[28px] bg-white dark:bg-[#121316] border border-black/[0.1] dark:border-white/[0.1] shadow-sm flex items-center justify-between gap-4">
            <div className="space-y-2 max-w-[240px]">
              <h3 className="text-lg font-bold text-zinc-950 dark:text-white leading-tight">
                Your&apos;s hedge hub
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Invest, trade, and offset perp funding risk without touching spot or exchange balances.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab?.("overview")}
                className="inline-flex items-center gap-1 text-xs font-bold text-zinc-950 dark:text-white hover:underline pt-1"
              >
                <span>Learn more</span>
                <span className="text-xs">↗</span>
              </button>
            </div>
            <div className="flex-shrink-0">
              <CryptoHubIllustration className="w-24 h-24" />
            </div>
          </div>

          {/* Feature Card 2: 100% Solvency Vault (White card with satellite dish illustration) */}
          <div className="p-6 rounded-[28px] bg-white dark:bg-[#121316] border border-black/[0.1] dark:border-white/[0.1] shadow-sm flex items-center justify-between gap-4">
            <div className="space-y-2 max-w-[240px]">
              <h3 className="text-lg font-bold text-zinc-950 dark:text-white leading-tight">
                100% Solvency vault
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Vault accounts are program-derived PDAs on Solana. Zero mid-cycle leakage or counterparty default.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab?.("overview")}
                className="inline-flex items-center gap-1 text-xs font-bold text-zinc-950 dark:text-white hover:underline pt-1"
              >
                <span>Learn more</span>
                <span className="text-xs">↗</span>
              </button>
            </div>
            <div className="flex-shrink-0">
              <SatelliteIllustration className="w-24 h-24" />
            </div>
          </div>

          {/* Feature Card 3: Easy start (Vibrant Mint Green #74f89d Card from Screen 3!) */}
          <div className="p-6 rounded-[28px] bg-[#74f89d] text-zinc-950 shadow-md flex items-center justify-between gap-4">
            <div className="space-y-2 max-w-[240px]">
              <h3 className="text-lg font-extrabold text-zinc-950 leading-tight">
                Easy start
              </h3>
              <p className="text-xs text-zinc-800 leading-relaxed font-medium">
                Use our protocol with ease whether you are an experienced practitioner or a beginner.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab?.("replay")}
                className="inline-flex items-center gap-1 text-xs font-bold text-zinc-950 hover:underline pt-1"
              >
                <span>Learn more</span>
                <span className="text-xs">↗</span>
              </button>
            </div>
            <div className="flex-shrink-0">
              <LayeredCubesIllustration className="w-24 h-24" />
            </div>
          </div>

          {/* Collapsible 21-Epoch Settlement Ledger */}
          <div className="p-5 rounded-[28px] bg-white dark:bg-[#121316] border border-black/[0.1] dark:border-white/[0.1] shadow-sm space-y-3">
            <button
              onClick={() => setShowLedger(!showLedger)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-950 dark:text-white font-mono uppercase">
                  21-Epoch Settlement Ledger
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
                  21 Epochs
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showLedger ? "rotate-180" : ""}`} />
            </button>

            {showLedger && (
              <div className="space-y-1.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.06] max-h-60 overflow-y-auto pr-1 font-mono text-xs">
                {explanation.records.map((rec) => (
                  <div
                    key={rec.intervalIndex}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-950 dark:text-white">#{rec.intervalIndex}</span>
                      <span className="text-[11px] text-zinc-400">{formatRatePercent(rec.realizedRatePpm)}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(rec.intervalSettlementCents, true)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
