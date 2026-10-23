"use client";

import React, { useState, useEffect } from "react";
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
} from "../lib/solana/client.ts";
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
  // Demo lifecycle state
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

  // Derived addresses
  const [contractPda] = getContractPda(terms.contractId);
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

  // Handle Auto-Play
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlayingAuto && step === 4 && publishedCount < 21) {
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
  }, [isPlayingAuto, step, publishedCount, missingObsActive, terms]);

  // Reset entire demo
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
  };

  // Step 2: Deposit collateral
  const handleDepositBoth = () => {
    const buyerDeposit = shortfallActive ? req.buyerCollateralCents - 5000 : req.buyerCollateralCents;
    setBuyerDeposited(buyerDeposit);
    setTakerDeposited(req.riskTakerCollateralCents);
    setStep(3);
  };

  // Step 3: Activate
  const handleActivate = () => {
    setStep(4);
  };

  // Publish next single interval
  const handlePublishNext = () => {
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
  const handleFinalize = () => {
    if (missingObsActive) {
      // Prevent finalization
      return;
    }
    setIsFinalized(true);
    setStep(6);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header and Reset */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Interactive 7-Day Protocol Replay
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
              Deterministic Demo
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Observe the complete lifecycle: agreement → deposit → activation → oracle interval updates → net settlement
          </p>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo Flow</span>
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
              className={`p-3 rounded-lg border text-xs font-mono transition ${
                isCurrent
                  ? "bg-zinc-800 border-zinc-600 text-zinc-100 font-bold"
                  : isPast
                  ? "bg-zinc-950 border-zinc-800 text-zinc-400"
                  : "bg-zinc-950/40 border-zinc-900 text-zinc-600"
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

      {/* Interactive Controls & Status Card */}
      <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-6">
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
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition"
            >
              <span>Proceed to Collateral Deposit</span>
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

            <button
              onClick={handleDepositBoth}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition"
            >
              <span>Deposit Collateral into Vault PDA</span>
              <ArrowRight className="w-4 h-4" />
            </button>
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
                <button
                  onClick={() => setIsPlayingAuto(!isPlayingAuto)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition"
                >
                  {isPlayingAuto ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlayingAuto ? "Pause Auto-Publish" : "Auto-Publish 8h Epochs"}</span>
                </button>

                <button
                  onClick={handlePublishNext}
                  disabled={isPlayingAuto}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-300 disabled:opacity-50"
                >
                  <span>Step +1 Interval</span>
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
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-2 text-xs font-mono text-zinc-400">
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
