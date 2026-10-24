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
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
} from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { TransactionInstruction } from "@solana/web3.js";
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

interface HedgeSimulatorProps {
  customObservations?: FundingObservation[] | null;
}

export const HedgeSimulator: React.FC<HedgeSimulatorProps> = ({
  customObservations,
}) => {
  const [positionSide, setPositionSide] = useState<PositionSide>("long");
  const [notionalDollars, setNotionalDollars] = useState<number>(10000);
  const [fixedRatePercent, setFixedRatePercent] = useState<number>(0.02);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("baseline");
  const [showLedger, setShowLedger] = useState<boolean>(false);

  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [marketConfig, setMarketConfig] = useState<OnChainMarketConfig | null>(null);
  const [onChainContract, setOnChainContract] = useState<OnChainContractState | null>(null);
  const [chainAction, setChainAction] = useState<{
    state: "idle" | "pending" | "success" | "error";
    message: string;
  }>({ state: "idle", message: "" });

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
          `Insufficient Testnet SOL (balance: ${(lamports / 1e9).toFixed(4)} SOL). You need ~0.005 SOL for transaction fees. Fund at https://faucet.solana.com.`
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
    <div className="space-y-6 max-w-5xl mx-auto pb-16 font-sans">
      {/* 1. Header & Position Direction Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.08] dark:border-white/[0.08]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-semibold mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Binance SOL-PERP · 7-Day Cycle (21 Epochs)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
            Fixed-Rate Hedge Calculator
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Lock in a guaranteed funding rate for your perpetual swap position. Eliminate unpredictable 8h fee volatility.
          </p>
        </div>

        {/* Position Side Toggle (Long Hedge vs Short Hedge) */}
        <div className="p-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-1 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setPositionSide("long")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold font-mono transition ${
              positionSide === "long"
                ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Long Hedge</span>
          </button>
          <button
            type="button"
            onClick={() => setPositionSide("short")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold font-mono transition ${
              positionSide === "short"
                ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <span>Short Hedge</span>
            <ArrowDownRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Hero Target Outcome Banner */}
      <div className="p-6 sm:p-7 rounded-[28px] bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
            Target Net Funding Expense
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl sm:text-5xl font-extrabold text-zinc-950 dark:text-white tracking-tight font-mono">
              {formatCurrency(explanation.netFundingCostCents)}
            </span>
            <span className="text-base sm:text-lg font-mono text-zinc-400">USD</span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-1">
            Fixed at <strong className="text-zinc-950 dark:text-white">{fixedRatePercent > 0 ? `+${fixedRatePercent.toFixed(4)}%` : `${fixedRatePercent.toFixed(4)}%`}</strong> per 8h · Exactly $42.00 on $10k notional
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-2 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
            0.00% Net Variance Guaranteed
          </div>
          <span className="text-zinc-500 text-[11px]">
            Single net payout settles at cycle maturity
          </span>
        </div>
      </div>

      {/* 3. Two Core Cards Side-by-Side: Hedge Setup & Cash Flow Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Hedge Setup & Parameters */}
        <div className="p-6 rounded-[28px] bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
                  ◎
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-950 dark:text-white">
                    Perpetual Position Exposure
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-mono">Binance SOL-PERP</span>
                </div>
              </div>

              <button
                type="button"
                onClick={resetToDocumentedBaseline}
                className="flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition"
                title="Reset to baseline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Notional Exposure Slider & Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500 font-medium">Hedged Notional Size:</span>
                <span className="font-bold text-zinc-950 dark:text-white text-sm">
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
                className="w-full accent-emerald-500 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full appearance-none cursor-pointer"
              />
              <div className="flex items-center gap-1.5 text-xs font-mono pt-0.5">
                {[1000, 5000, 10000, 25000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setNotionalDollars(amt)}
                    className={`flex-1 py-1 rounded-full text-[11px] transition font-semibold ${
                      notionalDollars === amt
                        ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    ${amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Rate Input & Presets */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500 font-medium">Target Fixed Rate:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {fixedRatePercent > 0 ? `+${fixedRatePercent.toFixed(4)}%` : `${fixedRatePercent.toFixed(4)}%`} / 8h
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.005"
                  min="-0.50"
                  max="0.50"
                  value={fixedRatePercent}
                  onChange={(e) => setFixedRatePercent(Number(e.target.value))}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono font-bold text-zinc-950 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono pt-0.5">
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
                    className={`flex-1 py-1 rounded-full text-[10px] transition font-semibold ${
                      Math.abs(fixedRatePercent - chip.val) < 0.0001
                        ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Market Scenario Presets */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 font-mono">
                Market Scenario Simulation:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.values(DEMO_SCENARIOS).map((sc) => {
                  const isSelected = selectedScenarioId === sc.id && !customObservations;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => {
                        setSelectedScenarioId(sc.id);
                        setFixedRatePercent(sc.defaultFixedRatePpm / 10000);
                      }}
                      className={`text-left p-2.5 rounded-2xl border transition ${
                        isSelected
                          ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-transparent shadow-xs"
                          : "bg-zinc-50 dark:bg-zinc-800/40 border-black/[0.04] dark:border-white/[0.04] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="font-bold text-[11px] truncate">{sc.name}</div>
                      <div className={`text-[10px] truncate ${isSelected ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400"}`}>
                        {sc.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Cash Flow Comparison & Solvency Vault */}
        <div className="p-6 rounded-[28px] bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  $
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-950 dark:text-white">
                    Cash Flow Normalization
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-mono">Solana Escrow Offset</span>
                </div>
              </div>

              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                100% Solvency
              </span>
            </div>

            {/* Comparison Metrics */}
            <div className="space-y-2.5 font-mono text-xs">
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase block">1. Unhedged Binance Expense</span>
                  <span className="font-bold text-zinc-950 dark:text-white text-sm">
                    {formatCurrency(explanation.totalActualFundingCostCents)}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500">Paid to Exchange</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase block">2. FundingLock Net Offset</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {formatCurrency(explanation.totalSettlementCents, true)}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Maturity Credit</span>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-600 uppercase font-bold block">
                    = Net Guaranteed Cost
                  </span>
                  <span className="text-lg font-extrabold">
                    {formatCurrency(explanation.netFundingCostCents)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-400 dark:text-emerald-600 font-bold block uppercase">
                    Zero Volatility
                  </span>
                  <span className="text-[11px] font-semibold">Target Achieved</span>
                </div>
              </div>
            </div>

            {/* Vault Collateral Sizing Summary */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.04] space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-medium">Vault Collateral Required:</span>
                <span className="font-bold text-zinc-950 dark:text-white">
                  {formatCurrency(explanation.requiredCollateralBuyerCents + explanation.requiredCollateralRiskTakerCents)}
                  <span className="text-[10px] font-normal text-emerald-500 ml-1">
                    (~{((explanation.requiredCollateralBuyerCents + explanation.requiredCollateralRiskTakerCents) / 10000).toFixed(2)} SOL)
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500 pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                <div>Buyer Margin: <strong className="text-zinc-800 dark:text-zinc-200">{formatCurrency(explanation.requiredCollateralBuyerCents)}</strong></div>
                <div>Taker Margin: <strong className="text-zinc-800 dark:text-zinc-200">{formatCurrency(explanation.requiredCollateralRiskTakerCents)}</strong></div>
              </div>
            </div>
          </div>

          {/* Action Button: Post Offer on Solana Testnet */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={handleCreateOfferOnChain}
              disabled={chainAction.state === "pending"}
              className="w-full py-3 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold font-mono flex items-center justify-center gap-2 shadow-md active:scale-98 transition disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {chainAction.state === "pending"
                  ? "Awaiting Wallet Approval…"
                  : wallet.connected
                  ? "Create Fixed-Rate Offer on Solana Testnet"
                  : "Connect Wallet to Lock Rate"}
              </span>
            </button>

            {onChainContract && (
              <div className="text-center text-[11px] font-mono text-zinc-500">
                Created: <strong className="text-zinc-900 dark:text-zinc-100">{onChainContract.contractId}</strong> · State: <span className="text-emerald-500 font-bold">{onChainContract.lifecycleLabel}</span>
              </div>
            )}

            {chainAction.message && (
              <p
                className={`text-center text-[11px] font-mono ${
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
      </div>

      {/* 4. Collapsible 21-Epoch Settlement Ledger */}
      <div className="p-5 rounded-[28px] bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] shadow-sm space-y-4">
        <button
          onClick={() => setShowLedger(!showLedger)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2.5">
            <h3 className="font-bold text-sm text-zinc-950 dark:text-white font-mono">
              21-Epoch Settlement Ledger
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-400 font-semibold">
              {explanation.records.length} Epochs
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
            <span>{showLedger ? "Hide Ledger" : "Show Epoch Breakdown"}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showLedger ? "rotate-180" : ""}`} />
          </div>
        </button>

        {showLedger && (
          <div className="space-y-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06] animate-in fade-in duration-150">
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
              {explanation.records.map((rec) => (
                <div
                  key={rec.intervalIndex}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-black/[0.03] dark:border-white/[0.04]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-zinc-950 dark:text-white">#{rec.intervalIndex}</span>
                    <span className="text-[11px] text-zinc-500">
                      Rate: <strong className="text-zinc-800 dark:text-zinc-200">{formatRatePercent(rec.realizedRatePpm)}</strong>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(rec.intervalSettlementCents, true)}
                    </span>
                    <span className="text-[10px] text-zinc-400 ml-2">
                      Cum: {formatCurrency(rec.cumulativeSettlementCents, true)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
