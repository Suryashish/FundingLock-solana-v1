"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  BASELINE_CONTRACT_TERMS,
  BASELINE_DOCUMENTED_OBSERVATIONS,
} from "../lib/data/fixtures.ts";
import { BINANCE_SOL_CONFIG } from "../lib/domain/types.ts";
import {
  calculateFundingCost,
  calculateIntervalSettlement,
  formatCurrency,
  formatRatePercent,
} from "../lib/domain/funding.ts";
import {
  calculateCollateralRequirement,
} from "../lib/domain/collateral.ts";
import {
  PROGRAM_ID,
  getContractPda,
  getVaultPda,
  buildAcceptOfferIx,
  buildActivateContractIx,
  buildCreateOfferIx,
  buildDepositCollateralIx,
  buildFinalizeContractIx,
  buildInitializeMarketIx,
  buildRecordObservationIx,
} from "../lib/solana/client.ts";
import { TransactionInstruction } from "@solana/web3.js";
import {
  createContractId,
  fetchContractAccount,
  fetchMarketConfig,
  formatSignature,
  simulateAndSendTransaction,
  type OnChainContractState,
} from "../lib/solana/transactions.ts";
import {
  Play,
  RotateCcw,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Pause,
  Wallet,
  ChevronDown,
  Layers,
} from "lucide-react";

export const ReplayDemo: React.FC = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();

  // Execution mode: "simulation" (instant, zero wallet needed) or "onchain" (real Solana Testnet txs)
  const [executionMode, setExecutionMode] = useState<"simulation" | "onchain">("simulation");

  // Lifecycle state (Steps 1 through 6)
  const [step, setStep] = useState<number>(1);
  const [isPlayingAuto, setIsPlayingAuto] = useState<boolean>(false);
  const [missingObsActive, setMissingObsActive] = useState<boolean>(false);
  const [shortfallActive, setShortfallActive] = useState<boolean>(false);
  const [notionalDollars, setNotionalDollars] = useState<number>(10000);
  const [showAddressDetails, setShowAddressDetails] = useState<boolean>(false);

  // Contract terms
  const terms = useMemo(() => ({
    ...BASELINE_CONTRACT_TERMS,
    notionalCents: notionalDollars * 100,
  }), [notionalDollars]);

  const req = calculateCollateralRequirement(terms, BINANCE_SOL_CONFIG);

  // Deposits
  const [buyerDeposited, setBuyerDeposited] = useState<number>(0);
  const [takerDeposited, setTakerDeposited] = useState<number>(0);

  // Observations submitted
  const [publishedCount, setPublishedCount] = useState<number>(0);
  const [accumulatedSettlementCents, setAccumulatedSettlementCents] = useState<number>(0);
  const [isFinalized, setIsFinalized] = useState<boolean>(false);
  const [onChainContractId, setOnChainContractId] = useState<string | null>(null);
  const [onChainState, setOnChainState] = useState<OnChainContractState | null>(null);
  const [chainAction, setChainAction] = useState<{
    state: "idle" | "pending" | "success" | "error";
    message: string;
  }>({ state: "idle", message: "" });

  // Derived addresses
  const activeContractId = onChainContractId ?? terms.contractId;
  const [contractPda] = getContractPda(activeContractId);
  const [vaultPda] = getVaultPda(contractPda);

  // Ledger records
  const records = useMemo(() => {
    let cum = 0;
    const list = [];
    for (let i = 0; i < publishedCount; i++) {
      const obs = BASELINE_DOCUMENTED_OBSERVATIONS[i];
      if (missingObsActive && i === 14) {
        continue;
      }
      const actualCost = calculateFundingCost(terms.notionalCents, terms.positionSide, obs.ratePpm);
      const settlement = calculateIntervalSettlement(
        terms.notionalCents,
        terms.positionSide,
        terms.fixedRatePpm,
        obs.ratePpm
      );
      cum += settlement;
      list.push({
        index: i,
        time: obs.startTime,
        ratePpm: obs.ratePpm,
        actualCost,
        settlement,
        cum,
      });
    }
    return list;
  }, [publishedCount, missingObsActive, terms]);

  // Sync on-chain state if active
  useEffect(() => {
    if (!onChainContractId) return;
    let active = true;
    fetchContractAccount(connection, onChainContractId)
      .then((account) => {
        if (!active || !account) return;
        setOnChainState(account);
        setPublishedCount(account.submittedObservationsCount);
        setAccumulatedSettlementCents(Number(account.accumulatedSettlementCents));
        if (account.lifecycleLabel === "Settled") {
          setIsFinalized(true);
          setStep(6);
        } else if (account.lifecycleLabel === "Settling" && account.submittedObservationsCount >= account.intervalCount) {
          setStep(5);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [connection, onChainContractId]);

  // Auto-Play in simulation mode
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!onChainContractId && isPlayingAuto && step === 4 && publishedCount < 21) {
      timer = setTimeout(() => {
        setPublishedCount((prev) => {
          const next = prev + 1;
          const obs = BASELINE_DOCUMENTED_OBSERVATIONS[prev];
          if (!(missingObsActive && prev === 14)) {
            const settlement = calculateIntervalSettlement(
              terms.notionalCents,
              terms.positionSide,
              terms.fixedRatePpm,
              obs.ratePpm
            );
            setAccumulatedSettlementCents((c) => c + settlement);
          }
          if (next >= 21) {
            setIsPlayingAuto(false);
            setStep(5);
          }
          return next;
        });
      }, 200);
    }
    return () => clearTimeout(timer);
  }, [isPlayingAuto, step, publishedCount, missingObsActive, terms, onChainContractId]);

  const runOnChainAction = async (action: () => Promise<string>, successPrefix: string) => {
    setChainAction({ state: "pending", message: "Preparing and simulating transaction…" });
    try {
      const signature = await action();
      setChainAction({ state: "success", message: `${successPrefix} Tx: ${formatSignature(signature)}.` });
      return signature;
    } catch (error) {
      setChainAction({
        state: "error",
        message: error instanceof Error ? error.message : "Transaction failed.",
      });
      return null;
    }
  };

  const refreshOnChainState = async (contractId = onChainContractId) => {
    if (!contractId) return null;
    const account = await fetchContractAccount(connection, contractId);
    setOnChainState(account);
    if (account) {
      setPublishedCount(account.submittedObservationsCount);
      setAccumulatedSettlementCents(Number(account.accumulatedSettlementCents));
    }
    return account;
  };

  const handleReset = () => {
    setStep(1);
    setIsPlayingAuto(false);
    setBuyerDeposited(0);
    setTakerDeposited(0);
    setPublishedCount(0);
    setAccumulatedSettlementCents(0);
    setIsFinalized(false);
    setMissingObsActive(false);
    setShortfallActive(false);
    setOnChainContractId(null);
    setOnChainState(null);
    setChainAction({ state: "idle", message: "" });
  };

  // Step 1: Start Walkthrough (Simulation)
  const handleStartSimulatedWalkthrough = () => {
    setBuyerDeposited(0);
    setTakerDeposited(0);
    setStep(2);
  };

  // Step 1: Create On-Chain Contract on Testnet
  const handleCreateOnChainContract = async () => {
    if (!wallet.publicKey) {
      setChainAction({ state: "error", message: "Please connect your wallet first." });
      setVisible(true);
      return;
    }
    try {
      const lamports = await connection.getBalance(wallet.publicKey, "confirmed");
      if (lamports < 5_000_000) {
        setChainAction({
          state: "error",
          message: `Insufficient Testnet SOL (balance: ${(lamports / 1e9).toFixed(4)} SOL). Need ~0.005 SOL for transaction fees. Ensure wallet is set to Testnet and fund it at https://faucet.solana.com.`
        });
        return;
      }

      const marketConfig = await fetchMarketConfig(connection).catch(() => null);
      const instructions: TransactionInstruction[] = [];

      if (!marketConfig) {
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
      } else if (marketConfig.isPaused) {
        setChainAction({ state: "error", message: "The on-chain SOL-PERP market is currently paused." });
        return;
      }

      const contractId = createContractId("RPL", wallet.publicKey);
      instructions.push(
        buildCreateOfferIx({
          contractId,
          marketSymbol: terms.marketSymbol,
          buyer: wallet.publicKey,
          positionSide: terms.positionSide,
          notionalCents: terms.notionalCents,
          fixedRatePpm: terms.fixedRatePpm,
          intervalCount: terms.intervalCount,
          startTime: Math.floor(Date.now() / 1000),
        })
      );

      const signature = await runOnChainAction(
        () => simulateAndSendTransaction({
          connection,
          wallet,
          description: marketConfig ? "Create replay contract" : "Initialize market & create replay contract",
          instructions,
        }),
        `Replay contract ${contractId} created on Testnet!`,
      );
      if (!signature) return;
      setOnChainContractId(contractId);
      const account = await refreshOnChainState(contractId);
      if (account) setStep(2);
    } catch (err) {
      setChainAction({
        state: "error",
        message: err instanceof Error ? err.message : "Failed to create contract on chain.",
      });
    }
  };

  const handleAcceptOnChainContract = async () => {
    if (!wallet.publicKey || !onChainContractId) {
      setChainAction({ state: "error", message: "Connect a risk-taker wallet to accept the contract." });
      return;
    }
    const signature = await runOnChainAction(
      () => simulateAndSendTransaction({
        connection,
        wallet,
        description: "Accept replay contract",
        instructions: [buildAcceptOfferIx({ contractPda, riskTaker: wallet.publicKey! })],
      }),
      "Risk taker accepted the replay contract.",
    );
    if (signature) await refreshOnChainState();
  };

  // Step 2: Deposit collateral
  const handleDepositBoth = async () => {
    if (onChainContractId) {
      if (!wallet.publicKey) {
        setChainAction({ state: "error", message: "Connect your wallet to deposit collateral." });
        return;
      }
      const account = await refreshOnChainState();
      if (!account) {
        setChainAction({ state: "error", message: "Could not fetch contract account from Testnet." });
        return;
      }
      const isBuyer = account.buyer.equals(wallet.publicKey);
      const isRiskTaker = account.riskTaker.equals(wallet.publicKey);
      if (!isBuyer && !isRiskTaker) {
        setChainAction({ state: "error", message: "This wallet is not a registered party to this contract." });
        return;
      }
      const amount = isBuyer
        ? account.requiredBuyerCollateral - account.depositedBuyerCollateral
        : account.requiredRiskTakerCollateral - account.depositedRiskTakerCollateral;
      if (amount <= BigInt(0)) {
        setChainAction({ state: "error", message: "Required collateral is already fully deposited." });
        return;
      }
      const signature = await runOnChainAction(
        () => simulateAndSendTransaction({
          connection,
          wallet,
          description: "Deposit replay collateral",
          instructions: [buildDepositCollateralIx({
            contractPda,
            vaultPda,
            depositor: wallet.publicKey!,
            amountLamports: Number(amount),
          })],
        }),
        `Deposited ${(Number(amount) / 1e9).toFixed(4)} SOL into vault PDA.`,
      );
      if (signature) {
        const updated = await refreshOnChainState();
        if (updated?.lifecycleLabel === "Funded") setStep(3);
      }
      return;
    }

    // Simulation path
    const buyerDeposit = shortfallActive ? req.buyerCollateralCents - 5000 : req.buyerCollateralCents;
    setBuyerDeposited(buyerDeposit);
    setTakerDeposited(req.riskTakerCollateralCents);
    setStep(3);
  };

  // Step 3: Activate
  const handleActivate = async () => {
    if (onChainContractId) {
      if (!wallet.publicKey) {
        setChainAction({ state: "error", message: "Connect wallet to activate the funded contract." });
        return;
      }
      const marketConfig = await fetchMarketConfig(connection).catch(() => null);
      if (!marketConfig) {
        setChainAction({ state: "error", message: "Market config could not be read from Testnet." });
        return;
      }
      const signature = await runOnChainAction(
        () => simulateAndSendTransaction({
          connection,
          wallet,
          description: "Activate replay contract",
          instructions: [buildActivateContractIx({
            contractPda,
            marketConfigPda: marketConfig.address,
            authority: wallet.publicKey!,
          })],
        }),
        "Replay contract activated on Testnet.",
      );
      if (signature) {
        const updated = await refreshOnChainState();
        if (updated?.lifecycleLabel === "Active") setStep(4);
      }
      return;
    }
    // Simulation path
    setStep(4);
  };

  // Step 4: Publish next single interval
  const handlePublishNext = async () => {
    if (onChainContractId) {
      if (!wallet.publicKey) {
        setChainAction({ state: "error", message: "Connect oracle wallet to publish observations." });
        return;
      }
      const account = await refreshOnChainState();
      if (!account) return;
      const observation = BASELINE_DOCUMENTED_OBSERVATIONS[account.submittedObservationsCount];
      if (!observation) {
        setChainAction({ state: "error", message: "All 21 observations have already been recorded." });
        return;
      }
      const marketConfig = await fetchMarketConfig(connection).catch(() => null);
      if (!marketConfig) return;
      const signature = await runOnChainAction(
        () => simulateAndSendTransaction({
          connection,
          wallet,
          description: `Record funding observation #${observation.intervalIndex}`,
          instructions: [buildRecordObservationIx({
            contractPda,
            marketConfigPda: marketConfig.address,
            oracleAuthority: wallet.publicKey!,
            intervalIndex: observation.intervalIndex,
            realizedRatePpm: observation.ratePpm,
            recordedAt: Math.floor(Date.now() / 1000),
          })],
        }),
        `Observation #${observation.intervalIndex} recorded on Testnet.`,
      );
      if (signature) {
        const updated = await refreshOnChainState();
        if (updated && updated.submittedObservationsCount >= updated.intervalCount) setStep(5);
      }
      return;
    }

    // Simulation path
    if (publishedCount < 21) {
      const idx = publishedCount;
      const obs = BASELINE_DOCUMENTED_OBSERVATIONS[idx];
      setPublishedCount(idx + 1);

      if (!(missingObsActive && idx === 14)) {
        const settlement = calculateIntervalSettlement(
          terms.notionalCents,
          terms.positionSide,
          terms.fixedRatePpm,
          obs.ratePpm
        );
        setAccumulatedSettlementCents((c) => c + settlement);
      }

      if (idx + 1 >= 21) {
        setStep(5);
      }
    }
  };

  // Step 5: Finalize
  const handleFinalize = async () => {
    if (onChainContractId) {
      if (!wallet.publicKey) {
        setChainAction({ state: "error", message: "Connect wallet to finalize the contract." });
        return;
      }
      const account = await refreshOnChainState();
      if (!account) return;
      const signature = await runOnChainAction(
        () => simulateAndSendTransaction({
          connection,
          wallet,
          description: "Finalize replay contract",
          instructions: [buildFinalizeContractIx({
            contractPda,
            vaultPda,
            buyer: account.buyer,
            riskTaker: account.riskTaker,
            caller: wallet.publicKey!,
          })],
        }),
        "Contract settled & collateral distributed at maturity!",
      );
      if (signature) {
        setIsFinalized(true);
        setStep(6);
        await refreshOnChainState();
      }
      return;
    }

    // Simulation path
    setIsFinalized(true);
    setStep(6);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 font-sans">
      {/* 1. Header Toolbar with Mode Selector & Reset */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.08] dark:border-white/[0.08]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-semibold mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Interactive Protocol Lifecycle</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
            Contract Lifecycle Flow
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Test how a fixed-rate hedge agreement progresses through all 6 phases: matching, escrowing, oracle publication, and final settlement.
          </p>
        </div>

        {/* Execution Mode Selector & Reset */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="p-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-1 text-xs font-medium font-mono">
            <button
              onClick={() => {
                setExecutionMode("simulation");
                handleReset();
              }}
              className={`px-3 py-1.5 rounded-full transition ${
                executionMode === "simulation"
                  ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              Walkthrough
            </button>
            <button
              onClick={() => {
                setExecutionMode("onchain");
                handleReset();
              }}
              className={`px-3 py-1.5 rounded-full transition ${
                executionMode === "onchain"
                  ? "bg-[#74f89d] text-zinc-950 font-bold shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              Solana Testnet
            </button>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-xs font-mono text-zinc-600 dark:text-zinc-400 transition"
            title="Reset flow to Step 1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* 2. Step Progress Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { num: 1, title: "1. Match Terms" },
          { num: 2, title: "2. Escrow Margin" },
          { num: 3, title: "3. Activate" },
          { num: 4, title: "4. Record Epochs" },
          { num: 5, title: "5. Maturity" },
          { num: 6, title: "6. Net Payout" },
        ].map((s) => {
          const isCurrent = step === s.num;
          const isPast = step > s.num;
          return (
            <div
              key={s.num}
              className={`p-3 rounded-2xl border text-xs font-mono transition-all ${
                isCurrent
                  ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-md border-transparent"
                  : isPast
                  ? "bg-[#74f89d]/15 border-[#74f89d]/40 text-emerald-800 dark:text-[#74f89d] font-semibold"
                  : "bg-white dark:bg-[#121316] border-black/[0.1] dark:border-white/[0.1] text-zinc-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{s.title}</span>
                {isPast && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Notification Message */}
      {chainAction.message && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-mono flex items-center justify-between ${
            chainAction.state === "error"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
              : chainAction.state === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              : "bg-zinc-100 dark:bg-zinc-800 border-black/[0.06] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300"
          }`}
        >
          <span>{chainAction.message}</span>
          <button
            onClick={() => setChainAction({ state: "idle", message: "" })}
            className="text-xs opacity-60 hover:opacity-100 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Main Step Interactive Card */}
      <div className="p-6 sm:p-7 rounded-[28px] bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] shadow-sm space-y-6">
        {/* STEP 1: Terms Agreement */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
                  Step 1 of 6
                </span>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                  Match Contract Terms
                </h3>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
                Status: OPEN
              </span>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Trader specifies perpetual position side, notional exposure, and agreed fixed funding rate. Counterparty agrees to take the opposing cash flow.
            </p>

            {/* Terms Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase">POSITION SIDE</span>
                <div className="text-zinc-950 dark:text-white font-bold text-sm">LONG (+1)</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase">NOTIONAL SIZE</span>
                <div className="text-zinc-950 dark:text-white font-bold text-sm">
                  {formatCurrency(terms.notionalCents)}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase">TARGET FIXED RATE</span>
                <div className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                  {formatRatePercent(terms.fixedRatePpm)} / 8h
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase">DURATION</span>
                <div className="text-zinc-950 dark:text-white font-bold text-sm">7 Days (21 Epochs)</div>
              </div>
            </div>

            {/* Quick Notional Size Selector */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono pt-1">
              <span className="text-zinc-500 text-[11px]">Adjust Notional:</span>
              {[
                { amt: 1000, label: "$1,000" },
                { amt: 5000, label: "$5,000" },
                { amt: 10000, label: "$10,000 (Baseline)" },
                { amt: 25000, label: "$25,000" },
              ].map(({ amt, label }) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setNotionalDollars(amt)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${
                    notionalDollars === amt
                      ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-xs"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Primary Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              {executionMode === "simulation" ? (
                <button
                  onClick={handleStartSimulatedWalkthrough}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-md hover:opacity-90 active:scale-98 transition"
                >
                  <span>Start 7-Day Replay Walkthrough</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleCreateOnChainContract}
                  disabled={chainAction.state === "pending"}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#74f89d] hover:bg-[#5df68b] text-zinc-950 text-xs font-bold shadow-md active:scale-98 transition disabled:opacity-50"
                >
                  <Wallet className="w-4 h-4" />
                  <span>
                    {chainAction.state === "pending"
                      ? "Awaiting Wallet..."
                      : "Create Contract PDA on Solana Testnet"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Escrow Collateral */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
                  Step 2 of 6
                </span>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                  Escrow Required Collateral
                </h3>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
                Status: MATCHED / AWAITING DEPOSIT
              </span>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Both parties must deposit bound-calculated collateral plus a 5% solvency buffer into the program-derived vault PDA before activation is permitted.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1.5">
                <span className="text-zinc-400 text-[10px] uppercase">BUYER REQUIRED DEPOSIT</span>
                <div className="text-2xl font-bold text-zinc-950 dark:text-white">
                  {formatCurrency(req.buyerCollateralCents)}
                </div>
                <div className="text-[11px] text-zinc-500">
                  Max downside coverage + 5% buffer (~{(req.buyerCollateralCents / 10000).toFixed(2)} SOL)
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1.5">
                <span className="text-zinc-400 text-[10px] uppercase">RISK TAKER REQUIRED DEPOSIT</span>
                <div className="text-2xl font-bold text-zinc-950 dark:text-white">
                  {formatCurrency(req.riskTakerCollateralCents)}
                </div>
                <div className="text-[11px] text-zinc-500">
                  Full buyer payout coverage + 5% buffer (~{(req.riskTakerCollateralCents / 10000).toFixed(2)} SOL)
                </div>
              </div>
            </div>

            {/* Edge Case Simulation Toggle (Walkthrough Mode) */}
            {executionMode === "simulation" && (
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 border border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Simulate Underfunded Deposit Edge Case:
                </span>
                <button
                  type="button"
                  onClick={() => setShortfallActive(!shortfallActive)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                    shortfallActive
                      ? "bg-amber-500 text-zinc-950 font-bold"
                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {shortfallActive ? "Shortfall Active (-$50 Short)" : "Standard 100% Funded"}
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              {onChainContractId && onChainState?.lifecycleLabel === "Open" && (
                <button
                  onClick={handleAcceptOnChainContract}
                  disabled={chainAction.state === "pending"}
                  className="px-5 py-2.5 rounded-full bg-[#74f89d] hover:bg-[#5df68b] text-zinc-950 text-xs font-bold transition"
                >
                  Accept Offer as Risk Taker
                </button>
              )}
              <button
                onClick={handleDepositBoth}
                disabled={chainAction.state === "pending"}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-md hover:opacity-90 active:scale-98 transition disabled:opacity-50"
              >
                <span>
                  {onChainContractId
                    ? "Deposit This Wallet's Collateral"
                    : "Deposit Collateral into Vault PDA"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Activation */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
                  Step 3 of 6
                </span>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                  Activate Contract on Solana
                </h3>
              </div>
              <span
                className={`text-xs font-mono px-2.5 py-1 rounded-full font-semibold ${
                  shortfallActive
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {shortfallActive ? "State: UNDERFUNDED (BLOCKED)" : "State: FUNDED (READY)"}
              </span>
            </div>

            {shortfallActive ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2 text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Activation Guard Triggered: Collateral Shortfall Detected</span>
                </div>
                <p className="text-amber-800 dark:text-amber-300/80 leading-relaxed">
                  Buyer deposit was short by $50.00. The Solana contract strictly prevents transition to ACTIVE unless 100% of the calculated bound requirements are locked in the PDA.
                </p>
                <button
                  onClick={() => {
                    setShortfallActive(false);
                    setBuyerDeposited(req.buyerCollateralCents);
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400 transition"
                >
                  Top Up Remaining $50.00
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 font-bold text-zinc-950 dark:text-white">
                  <Lock className="w-4 h-4 text-emerald-500" />
                  <span>Both Parties Fully Funded</span>
                </div>
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Vault PDA Escrow Balance:</span>
                  <span className="font-bold text-zinc-950 dark:text-white text-sm">
                    {formatCurrency(buyerDeposited + takerDeposited)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 pt-1">
                  Once activated, contract terms are immutable on-chain. Mid-cycle withdrawals are prohibited.
                </p>
              </div>
            )}

            {!shortfallActive && (
              <button
                onClick={handleActivate}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-md hover:opacity-90 active:scale-98 transition"
              >
                <span>Activate Contract on Solana</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* STEP 4, 5, 6: Oracles, Maturity, Settlement */}
        {(step === 4 || step === 5 || step === 6) && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
                  {step === 6 ? "Step 6 of 6" : step === 5 ? "Step 5 of 6" : "Step 4 of 6"}
                </span>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                  {step === 6
                    ? "Settled at Maturity"
                    : step === 5
                    ? "Epochs Completed - Ready for Payout"
                    : "Oracle Observations Recording"}
                </h3>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
                {publishedCount} / 21 Observations
              </span>
            </div>

            {/* Step 4 Controls */}
            {step === 4 && (
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {!onChainContractId && (
                  <button
                    onClick={() => setIsPlayingAuto(!isPlayingAuto)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-xs hover:opacity-90 transition"
                  >
                    {isPlayingAuto ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlayingAuto ? "Pause Auto-Publish" : "Auto-Publish 8h Epochs"}</span>
                  </button>
                )}

                <button
                  onClick={handlePublishNext}
                  disabled={isPlayingAuto || chainAction.state === "pending"}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-mono text-zinc-800 dark:text-zinc-200 font-semibold transition disabled:opacity-50"
                >
                  <span>{onChainContractId ? "Publish Next Observation" : "Step +1 Epoch"}</span>
                </button>

                {!onChainContractId && (
                  <button
                    onClick={() => setMissingObsActive(!missingObsActive)}
                    className={`px-3.5 py-2 rounded-full text-xs font-mono font-semibold transition ${
                      missingObsActive
                        ? "bg-amber-500 text-zinc-950 font-bold"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {missingObsActive ? "Missing Obs #14 Active" : "Simulate Missing Obs #14"}
                  </button>
                )}
              </div>
            )}

            {/* Missing observation warning */}
            {missingObsActive && publishedCount >= 14 && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Observation Missing for Interval #14</strong>
                  <p className="text-amber-800 dark:text-amber-300/80 text-[11px] mt-0.5">
                    Protocol halts settlement automatically. Missing observations are never defaulted to zero.
                  </p>
                </div>
              </div>
            )}

            {/* Accounting Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase">EPOCHS RECORDED</span>
                <div className="text-base font-bold text-zinc-950 dark:text-white">{publishedCount} / 21</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase">REALIZED AVG RATE</span>
                <div className="text-base font-bold text-zinc-950 dark:text-white">+0.1000%</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase">NET SETTLEMENT</span>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(accumulatedSettlementCents, true)}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.04] space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase">TOKEN TRANSFERS</span>
                <div className="text-base font-bold text-zinc-700 dark:text-zinc-300">
                  {isFinalized ? "Transferred (1)" : "0 (Accounting Only)"}
                </div>
              </div>
            </div>

            {/* Published intervals preview table */}
            {records.length > 0 && (
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 border border-black/[0.04] dark:border-white/[0.04] space-y-2 text-xs font-mono">
                <div className="text-[10px] text-zinc-500 uppercase font-bold">
                  Recorded Interval Ledger ({records.length}):
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-black/[0.04] dark:divide-white/[0.04] pr-1">
                  {records.map((r) => (
                    <div key={r.index} className="flex justify-between items-center text-[11px] pt-1 text-zinc-700 dark:text-zinc-300">
                      <span>Epoch #{r.index} (+0.1000%)</span>
                      <span className="text-zinc-400">Interval: +$8.00</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        Cum: {formatCurrency(r.cum, true)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Finalize Button */}
            {step === 5 && !isFinalized && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-950 dark:text-emerald-200">
                    All 21 Funding Observations Successfully Verified
                  </span>
                  <span className="text-xs font-mono text-emerald-800 dark:text-emerald-300">
                    Net Settlement Owed to Buyer: <strong>+$168.00</strong>
                  </span>
                </div>
                <button
                  onClick={handleFinalize}
                  disabled={missingObsActive}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#74f89d] hover:bg-[#5df68b] text-zinc-950 text-xs font-bold shadow-md active:scale-98 transition disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Execute Final Settlement Payout</span>
                </button>
              </div>
            )}

            {/* Step 6: Final Settled Report */}
            {isFinalized && (
              <div className="p-5 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 space-y-3 font-mono text-xs shadow-md">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                  <span>Contract Settled at Maturity!</span>
                </div>
                <div className="space-y-1.5 text-[11px] opacity-90">
                  <div>
                    • <strong>Protection Buyer Payout:</strong> Initial Margin ($1,146.60) + $168.00 Net Settlement = <strong>$1,314.60</strong>
                  </div>
                  <div>
                    • <strong>Risk Taker Return:</strong> Initial Margin ($1,058.40) - $168.00 Net Settlement = <strong>$890.40</strong>
                  </div>
                  <div>
                    • <strong>Final Net Funding Cost:</strong> $210 (Binance) - $168 (Offset) = <strong>$42.00 Fixed</strong> (Target achieved!)
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Solana Program & Vault PDA Info Accordion */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-black/[0.06] dark:border-white/[0.08] text-xs font-mono text-zinc-500 space-y-2">
        <button
          onClick={() => setShowAddressDetails(!showAddressDetails)}
          className="w-full flex items-center justify-between text-left text-zinc-700 dark:text-zinc-300 font-semibold"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" />
            <span>On-Chain PDA Addresses & Cryptographic Derivations</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAddressDetails ? "rotate-180" : ""}`} />
        </button>

        {showAddressDetails && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] animate-in fade-in duration-150">
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
              <span className="text-zinc-400 block text-[10px] uppercase">PROGRAM ID</span>
              <a
                href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-900 dark:text-zinc-100 truncate block hover:underline"
              >
                {PROGRAM_ID.toBase58()}
              </a>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
              <span className="text-zinc-400 block text-[10px] uppercase">CONTRACT PDA</span>
              <span className="text-zinc-900 dark:text-zinc-100 truncate block">
                {contractPda.toBase58()}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
              <span className="text-zinc-400 block text-[10px] uppercase">VAULT PDA</span>
              <span className="text-zinc-900 dark:text-zinc-100 truncate block">
                {vaultPda.toBase58()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
