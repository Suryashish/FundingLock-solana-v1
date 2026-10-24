"use client";

import React, { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
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
} from "lucide-react";

export const ReplayDemo: React.FC = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  // Lifecycle state; remains local until a Testnet contract is created.
  const [step, setStep] = useState<number>(1);
  const [isPlayingAuto, setIsPlayingAuto] = useState<boolean>(false);
  const [missingObsActive, setMissingObsActive] = useState<boolean>(false);
  const [shortfallActive, setShortfallActive] = useState<boolean>(false);

  // Contract terms
  const terms = BASELINE_CONTRACT_TERMS;
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
  const records = React.useMemo(() => {
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

  // Handle Auto-Play
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (onChainContractId || (isPlayingAuto && step === 4 && publishedCount < 21)) {
      if (onChainContractId) return () => undefined;
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
      }, 250);
    }
    return () => clearTimeout(timer);
  }, [isPlayingAuto, step, publishedCount, missingObsActive, terms, onChainContractId]);

  const runOnChainAction = async (action: () => Promise<string>, successPrefix: string) => {
    setChainAction({ state: "pending", message: "Simulating transaction…" });
    try {
      const signature = await action();
      setChainAction({ state: "success", message: `${successPrefix} Transaction ${formatSignature(signature)}.` });
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

  const handleCreateOnChainContract = async () => {
    if (!wallet.publicKey) {
      setChainAction({ state: "error", message: "Connect the buyer wallet before creating the replay contract." });
      return;
    }
    const lamports = await connection.getBalance(wallet.publicKey, "confirmed");
    if (lamports < 5_000_000) {
      setChainAction({
        state: "error",
        message: `Insufficient Testnet SOL (balance: ${(lamports / 1e9).toFixed(4)} SOL). You need ~0.005 SOL for transaction fees & account rent. Make sure your wallet is set to Testnet, and fund it at https://faucet.solana.com.`
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
        buyer: wallet.publicKey!,
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
      `Replay contract ${contractId} created on Testnet.`,
    );
    if (!signature) return;
    setOnChainContractId(contractId);
    const account = await refreshOnChainState(contractId);
    if (account) setStep(2);
  };

  const handleAcceptOnChainContract = async () => {
    if (!wallet.publicKey || !onChainContractId) {
      setChainAction({ state: "error", message: "Connect a risk-taker wallet after creating the replay contract." });
      return;
    }
    const account = await refreshOnChainState();
    if (!account) {
      setChainAction({ state: "error", message: "The replay contract account could not be read from Testnet." });
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

  // Reset the current flow view.
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

  // Step 2: Deposit collateral
  const handleDepositBoth = async () => {
    if (onChainContractId) {
      if (!wallet.publicKey) {
        setChainAction({ state: "error", message: "Connect the wallet that owns this side of the contract." });
        return;
      }
      const account = await refreshOnChainState();
      if (!account) {
        setChainAction({ state: "error", message: "The replay contract account could not be read from Testnet." });
        return;
      }
      const isBuyer = account.buyer.equals(wallet.publicKey);
      const isRiskTaker = account.riskTaker.equals(wallet.publicKey);
      if (!isBuyer && !isRiskTaker) {
        setChainAction({ state: "error", message: "This wallet is not one of the contract participants." });
        return;
      }
      const amount = isBuyer
        ? account.requiredBuyerCollateral - account.depositedBuyerCollateral
        : account.requiredRiskTakerCollateral - account.depositedRiskTakerCollateral;
      if (amount <= BigInt(0)) {
        setChainAction({ state: "error", message: "This wallet has already deposited its required collateral." });
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
        `Deposited ${(Number(amount) / 1_000_000_000).toFixed(4)} SOL into the replay vault.`,
      );
      if (signature) {
        const updated = await refreshOnChainState();
        if (updated?.lifecycleLabel === "Funded") setStep(3);
      }
      return;
    }

    const buyerDeposit = shortfallActive ? req.buyerCollateralCents - 5000 : req.buyerCollateralCents;
    setBuyerDeposited(buyerDeposit);
    setTakerDeposited(req.riskTakerCollateralCents);
    setStep(3);
  };

  // Step 3: Activate
  const handleActivate = async () => {
    if (onChainContractId) {
      if (!wallet.publicKey) {
        setChainAction({ state: "error", message: "Connect a wallet to activate the funded contract." });
        return;
      }
      const marketConfig = await fetchMarketConfig(connection).catch(() => null);
      if (!marketConfig) {
        setChainAction({ state: "error", message: "The SOL-PERP market configuration could not be read from Testnet." });
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
    setStep(4);
  };

  // Publish next single interval
  const handlePublishNext = async () => {
    if (onChainContractId) {
      if (!wallet.publicKey) {
        setChainAction({ state: "error", message: "Connect the configured oracle wallet before publishing observations." });
        return;
      }
      const account = await refreshOnChainState();
      if (!account) {
        setChainAction({ state: "error", message: "The replay contract account could not be read from Testnet." });
        return;
      }
      const observation = BASELINE_DOCUMENTED_OBSERVATIONS[account.submittedObservationsCount];
      if (!observation) {
        setChainAction({ state: "error", message: "All configured observations have already been recorded." });
        return;
      }
      const marketConfig = await fetchMarketConfig(connection).catch(() => null);
      if (!marketConfig) {
        setChainAction({ state: "error", message: "The SOL-PERP market configuration could not be read from Testnet." });
        return;
      }
      const signature = await runOnChainAction(
        () => simulateAndSendTransaction({
          connection,
          wallet,
          description: `Record funding observation ${observation.intervalIndex}`,
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

  // Finalize
  const handleFinalize = async () => {
    if (onChainContractId) {
      if (!wallet.publicKey) {
        setChainAction({ state: "error", message: "Connect a wallet to finalize the contract." });
        return;
      }
      const account = await refreshOnChainState();
      if (!account) {
        setChainAction({ state: "error", message: "The replay contract account could not be read from Testnet." });
        return;
      }
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
        "Replay contract finalized on Testnet.",
      );
      if (signature) {
        const updated = await refreshOnChainState();
        if (updated?.lifecycleLabel === "Settled") {
          setIsFinalized(true);
          setStep(6);
        }
      }
      return;
    }
    if (missingObsActive) {
      // Prevent finalization
      return;
    }
    setIsFinalized(true);
    setStep(6);
  };

  return (
    <div className="dashboard-page space-y-8 pb-16">
      {/* Header and Reset */}
      <div className="dashboard-toolbar">
        <div>
          <span className="dashboard-eyebrow">Live contract flow · Solana Testnet</span>
          <h1>FundingLock contract lifecycle</h1>
          <p>
            Create a real contract PDA, deposit native SOL, activate it, record oracle observations, and finalize the vault. Local preview controls are available only before a Testnet contract is created.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="dashboard-control-muted flex items-center gap-1.5 self-start"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Flow View</span>
        </button>
      </div>

      {/* Step Progress Tracker */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {[
          { num: 1, title: "1. Match Terms" },
          { num: 2, title: "2. Deposit Collateral" },
          { num: 3, title: "3. Activate Contract" },
          { num: 4, title: "4. Publish Oracles" },
          { num: 5, title: "5. Final Maturity" },
          { num: 6, title: "6. Net Payout" },
        ].map((s) => {
          const isCurrent = step === s.num;
          const isPast = step > s.num;
          return (
            <div
              key={s.num}
                className={`p-3 rounded-2xl border text-xs font-mono transition ${
                  isCurrent
                   ? "bg-[#7af6a7] border-[#7af6a7] text-zinc-950 font-bold shadow-[0_10px_30px_rgba(122,246,167,0.12)]"
                   : isPast
                   ? "bg-white/10 border-white/15 text-zinc-300"
                   : "bg-white/[0.04] border-white/[0.08] text-zinc-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{s.title}</span>
                {isPast && <CheckCircle2 className="w-3.5 h-3.5 text-zinc-300" />}
              </div>
            </div>
          );
        })}
      </div>

      {chainAction.message && (
        <div className={`rounded-2xl border px-4 py-3 text-xs font-mono ${chainAction.state === "error" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : chainAction.state === "success" ? "border-[#7af6a7]/30 bg-[#7af6a7]/10 text-[#b7ffcb]" : "border-white/10 bg-white/[0.06] text-zinc-300"}`}>
          {chainAction.message}
        </div>
      )}

      {/* Interactive Controls & Status Card */}
      <div className="dashboard-dark-card p-5 sm:p-7 rounded-[32px] bg-[#111211] border border-white/10 space-y-6 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
        {/* Step Content */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-zinc-400">Step 1: Matched Agreement</span>
              <span className="text-xs font-mono text-zinc-500">Contract State: MATCHED</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-850">
                <span className="text-zinc-500 text-[10px]">BUYER WALLET</span>
                <div className="text-zinc-200 mt-0.5 truncate">{terms.buyerPubkey}</div>
              </div>
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-850">
                <span className="text-zinc-500 text-[10px]">RISK TAKER WALLET</span>
                <div className="text-zinc-200 mt-0.5 truncate">{terms.riskTakerPubkey}</div>
              </div>
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-850">
                <span className="text-zinc-500 text-[10px]">NOTIONAL</span>
                <div className="text-zinc-200 mt-0.5 font-bold">{formatCurrency(terms.notionalCents)}</div>
              </div>
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-850">
                <span className="text-zinc-500 text-[10px]">FIXED RATE</span>
                <div className="text-zinc-200 mt-0.5 font-bold">{formatRatePercent(terms.fixedRatePpm)} / 8h</div>
              </div>
            </div>
            <button
              onClick={handleCreateOnChainContract}
              disabled={chainAction.state === "pending"}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition"
            >
              <span>{chainAction.state === "pending" ? "Awaiting wallet…" : "Create Contract on Testnet"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-zinc-400">Step 2: Deposit Required Collateral</span>
              <span className="text-xs font-mono text-zinc-500">Contract State: OPEN / MATCHED</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 space-y-2">
                <span className="text-zinc-400 text-[11px]">Buyer Required Deposit:</span>
                <div className="text-xl font-bold text-zinc-100">{formatCurrency(req.buyerCollateralCents)}</div>
                <div className="text-[11px] text-zinc-500">Max downside coverage + 5% buffer</div>
              </div>
              <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 space-y-2">
                <span className="text-zinc-400 text-[11px]">Risk Taker Required Deposit:</span>
                <div className="text-xl font-bold text-zinc-100">{formatCurrency(req.riskTakerCollateralCents)}</div>
                <div className="text-[11px] text-zinc-500">Full buyer payout coverage + 5% buffer</div>
              </div>
            </div>

            {/* Edge Case Toggle */}
            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Simulate Underfunded / Shortfall Edge Case:</span>
              <button
                type="button"
                onClick={() => setShortfallActive(!shortfallActive)}
                className={`px-3 py-1 rounded text-xs font-mono font-medium border ${
                  shortfallActive
                    ? "bg-zinc-800 text-zinc-100 border-zinc-600"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800"
                }`}
              >
                {shortfallActive ? "Shortfall Active (Deposit -$50 Short)" : "Standard 100% Funded"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onChainContractId && onChainState?.lifecycleLabel === "Open" && (
                <button
                  onClick={handleAcceptOnChainContract}
                  disabled={chainAction.state === "pending"}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#7af6a7] hover:bg-[#99f9ba] text-zinc-950 text-xs font-semibold transition disabled:opacity-50"
                >
                  <span>Accept as Risk Taker</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleDepositBoth}
                disabled={chainAction.state === "pending"}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition disabled:opacity-50"
              >
                <span>{onChainContractId ? "Deposit This Wallet's Collateral" : "Deposit Collateral into Vault PDA"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-zinc-400">Step 3: Activate Contract Terms</span>
              <span className="text-xs font-mono text-zinc-500">
                {shortfallActive ? "State: UNDERFUNDED (BLOCKED)" : "Contract State: FUNDED"}
              </span>
            </div>

            {shortfallActive ? (
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg text-xs space-y-2 text-zinc-300">
                <div className="flex items-center gap-2 font-semibold text-zinc-100">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Activation Blocked: Collateral Shortfall Detected</span>
                </div>
                <p className="text-zinc-400">
                  Buyer deposit was short by $50.00. The Solana contract strictly prevents state transition to ACTIVE unless both sides meet 100% of the bound-calculated collateral requirement.
                </p>
                <button
                  onClick={() => {
                    setShortfallActive(false);
                    setBuyerDeposited(req.buyerCollateralCents);
                  }}
                  className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono"
                >
                  Top Up Remaining $50.00
                </button>
              </div>
            ) : (
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg text-xs space-y-2 text-zinc-300 font-mono">
                <div className="flex items-center gap-2 font-semibold text-zinc-100">
                  <Lock className="w-4 h-4" />
                  <span>Both Parties Fully Funded</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Vault PDA Balance:</span>
                  <span className="text-zinc-100 font-bold">
                    {formatCurrency(buyerDeposited + takerDeposited)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 pt-1">
                  Clicking Activate locks terms permanently on-chain. Terms cannot be altered after activation.
                </p>
              </div>
            )}

            {!shortfallActive && (
              <button
                onClick={handleActivate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition"
              >
                <span>Activate Contract on Solana</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {(step === 4 || step === 5 || step === 6) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase text-zinc-400">
                  {step === 6 ? "Step 6: Settled at Maturity" : "Step 4 & 5: Oracle Publication"}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                  {step === 6 ? "SETTLED" : "SETTLING"}
                </span>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                {publishedCount} / 21 Observations
              </span>
            </div>

            {/* Interactive Control buttons */}
            {step === 4 && (
              <div className="flex flex-wrap items-center gap-2">
                {!onChainContractId && (
                  <button
                    onClick={() => setIsPlayingAuto(!isPlayingAuto)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition"
                  >
                    {isPlayingAuto ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlayingAuto ? "Pause Auto-Publish" : "Auto-Publish 8h Epochs"}</span>
                  </button>
                )}

                <button
                  onClick={handlePublishNext}
                  disabled={isPlayingAuto || chainAction.state === "pending"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-300 disabled:opacity-50"
                >
                  <span>{onChainContractId ? "Publish Next Observation" : "Step +1 Interval"}</span>
                </button>

                {/* Missing Observation Simulator Toggle */}
                <button
                  onClick={() => setMissingObsActive(!missingObsActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition ${
                    missingObsActive
                      ? "bg-zinc-800 text-zinc-100 border-zinc-600 font-bold"
                      : "bg-zinc-950 text-zinc-500 border-zinc-800"
                  }`}
                >
                  {missingObsActive ? "Missing Observation #14 Active" : "Simulate Missing Obs #14"}
                </button>
              </div>
            )}

            {/* Missing observation warning */}
            {missingObsActive && publishedCount >= 14 && (
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-zinc-200 shrink-0 mt-0.5" />
                <div>
                  <strong>Observation Missing for Interval #14</strong>
                  <p className="text-zinc-400 text-[11px] mt-0.5">
                    The protocol halts finalization safely. Missing data is never treated as zero.
                  </p>
                </div>
              </div>
            )}

            {/* Live Settlement Accounting Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 text-[10px]">INTERVALS RECORDED</span>
                <div className="text-zinc-100 font-bold text-base mt-0.5">{publishedCount} / 21</div>
              </div>
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 text-[10px]">REALIZED RATE</span>
                <div className="text-zinc-100 font-bold text-base mt-0.5">+0.1000%</div>
              </div>
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 text-[10px]">CUMULATIVE NET SETTLEMENT</span>
                <div className="text-zinc-100 font-bold text-base mt-0.5">
                  {formatCurrency(accumulatedSettlementCents, true)}
                </div>
              </div>
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 text-[10px]">TOKEN TRANSFERS</span>
                <div className="text-zinc-300 font-bold text-base mt-0.5">
                  {isFinalized ? "Transferred (1)" : "0 (Accounting Only)"}
                </div>
              </div>
            </div>

            {/* Live ledger rows preview */}
            {records.length > 0 && (
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-850 space-y-1.5 text-xs font-mono">
                <div className="text-[10px] text-zinc-500 uppercase">Live Published Intervals ({records.length}):</div>
                <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-zinc-900">
                  {records.map((r) => (
                    <div key={r.index} className="flex justify-between items-center text-[11px] pt-1 text-zinc-300">
                      <span>Interval #{r.index} (+0.1000%)</span>
                      <span className="text-zinc-400">Interval: +$8.00</span>
                      <span className="text-zinc-100 font-bold">Cum: {formatCurrency(r.cum, true)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Finalize Button */}
            {step === 5 && !isFinalized && (
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">
                    All 21 Funding Observations Recorded
                  </span>
                  <span className="text-xs font-mono text-zinc-400">
                    Net Settlement Owed to Buyer: <strong className="text-zinc-100">+$168.00</strong>
                  </span>
                </div>
                <button
                  onClick={handleFinalize}
                  disabled={missingObsActive}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Execute Final Settlement Payout</span>
                </button>
              </div>
            )}

            {/* Final Settled Report */}
            {isFinalized && (
              <div className="p-4 bg-zinc-950 border border-zinc-750 rounded-lg space-y-2 font-mono text-xs">
                <div className="flex items-center gap-2 text-zinc-100 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Contract Successfully Settled at Maturity!</span>
                </div>
                <div className="text-zinc-300 space-y-1 pt-1 text-[11px]">
                  <div>• Protection Buyer Received: Initial Deposit ($1,146.60) + $168.00 Net Settlement = <strong>$1,314.60</strong></div>
                  <div>• Risk Taker Received: Initial Deposit ($1,058.40) - $168.00 Net Settlement = <strong>$890.40</strong></div>
                  <div>• Resulting Net Funding Cost for Long Position: $210 - $168 = <strong>$42.00</strong> (Target achieved!)</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Program and Vault Addresses Card */}
      <div className="dashboard-dark-card p-4 rounded-2xl space-y-2 text-xs font-mono text-zinc-400">
        <div className="text-[10px] uppercase text-zinc-500">Solana Program & PDA Addresses:</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
          <div>
            <span className="text-zinc-500 block">PROGRAM ID</span>
            <span className="text-zinc-300 truncate block">{PROGRAM_ID.toBase58()}</span>
          </div>
          <div>
            <span className="text-zinc-500 block">CONTRACT PDA</span>
            <span className="text-zinc-300 truncate block">{contractPda.toBase58()}</span>
          </div>
          <div>
            <span className="text-zinc-500 block">COLLATERAL VAULT PDA</span>
            <span className="text-zinc-300 truncate block">{vaultPda.toBase58()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
