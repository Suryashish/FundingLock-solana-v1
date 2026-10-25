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
import { calculateCollateralRequirement } from "../lib/domain/collateral.ts";
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
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  createContractId,
  fetchContractAccount,
  fetchMarketConfig,
  formatSignature,
  simulateAndSendTransaction,
  type OnChainContractState,
} from "../lib/solana/transactions.ts";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  Layers,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Notice, PageHeader, Panel, SegmentedControl } from "./ApplicationUI";

export const ReplayDemo: React.FC = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();

  // Execution mode: "simulation" (instant, zero wallet needed) or "onchain" (real Solana Testnet txs)
  const [executionMode, setExecutionMode] = useState<"simulation" | "onchain">(
    "simulation",
  );

  // Lifecycle state (Steps 1 through 6)
  const [step, setStep] = useState<number>(1);
  const [isPlayingAuto, setIsPlayingAuto] = useState<boolean>(false);
  const [missingObsActive, setMissingObsActive] = useState<boolean>(false);
  const [shortfallActive, setShortfallActive] = useState<boolean>(false);
  const [notionalDollars, setNotionalDollars] = useState<number>(10000);
  const [walletBalanceLamports, setWalletBalanceLamports] = useState<
    number | null
  >(null);

  // Poll wallet balance on Testnet
  useEffect(() => {
    if (!wallet.publicKey) return;
    let active = true;
    connection
      .getBalance(wallet.publicKey, "confirmed")
      .then((bal) => {
        if (active) setWalletBalanceLamports(bal);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [connection, wallet.publicKey, step]);

  // Contract terms
  const terms = useMemo(
    () => ({
      ...BASELINE_CONTRACT_TERMS,
      notionalCents: notionalDollars * 100,
    }),
    [notionalDollars],
  );

  const req = calculateCollateralRequirement(terms, BINANCE_SOL_CONFIG);

  // Deposits
  const [buyerDeposited, setBuyerDeposited] = useState<number>(0);
  const [takerDeposited, setTakerDeposited] = useState<number>(0);

  // Observations submitted
  const [publishedCount, setPublishedCount] = useState<number>(0);
  const [accumulatedSettlementCents, setAccumulatedSettlementCents] =
    useState<number>(0);
  const [isFinalized, setIsFinalized] = useState<boolean>(false);
  const [onChainContractId, setOnChainContractId] = useState<string | null>(
    null,
  );
  const [onChainState, setOnChainState] = useState<OnChainContractState | null>(
    null,
  );
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
      const actualCost = calculateFundingCost(
        terms.notionalCents,
        terms.positionSide,
        obs.ratePpm,
      );
      const settlement = calculateIntervalSettlement(
        terms.notionalCents,
        terms.positionSide,
        terms.fixedRatePpm,
        obs.ratePpm,
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
        setAccumulatedSettlementCents(
          Number(account.accumulatedSettlementCents),
        );
        if (account.lifecycleLabel === "Settled") {
          setIsFinalized(true);
          setStep(6);
        } else if (
          account.lifecycleLabel === "Settling" &&
          account.submittedObservationsCount >= account.intervalCount
        ) {
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
    if (
      !onChainContractId &&
      isPlayingAuto &&
      step === 4 &&
      publishedCount < 21
    ) {
      timer = setTimeout(() => {
        const observation = BASELINE_DOCUMENTED_OBSERVATIONS[publishedCount];
        if (!(missingObsActive && publishedCount === 14)) {
          const settlement = calculateIntervalSettlement(
            terms.notionalCents,
            terms.positionSide,
            terms.fixedRatePpm,
            observation.ratePpm,
          );
          setAccumulatedSettlementCents((current) => current + settlement);
        }
        const next = publishedCount + 1;
        setPublishedCount(next);
        if (next >= 21) {
          setIsPlayingAuto(false);
          setStep(5);
        }
      }, 200);
    }
    return () => clearTimeout(timer);
  }, [
    isPlayingAuto,
    step,
    publishedCount,
    missingObsActive,
    terms,
    onChainContractId,
  ]);

  const runOnChainAction = async (
    action: () => Promise<string>,
    successPrefix: string,
  ) => {
    setChainAction({
      state: "pending",
      message: "Preparing and simulating transaction…",
    });
    try {
      const signature = await action();
      setChainAction({
        state: "success",
        message: `${successPrefix} Tx: ${formatSignature(signature)}.`,
      });
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
      setChainAction({
        state: "error",
        message: "Please connect your wallet first.",
      });
      setVisible(true);
      return;
    }
    try {
      const lamports = await connection.getBalance(
        wallet.publicKey,
        "confirmed",
      );
      const requiredBuyerLamports = req.buyerCollateralCents * 100_000;
      if (lamports < 5_000_000) {
        setChainAction({
          state: "error",
          message: `Insufficient Testnet SOL (balance: ${(lamports / 1e9).toFixed(4)} SOL). Need ~0.005 SOL for transaction fees. Ensure wallet is set to Testnet and fund it at https://faucet.solana.com.`,
        });
        return;
      }
      if (lamports < requiredBuyerLamports + 5_000_000) {
        setChainAction({
          state: "error",
          message: `Insufficient Testnet SOL (balance: ${(lamports / 1e9).toFixed(4)} SOL). Hedging $${notionalDollars.toLocaleString()} notional requires ${(requiredBuyerLamports / 1e9).toFixed(4)} SOL collateral + gas. Select $50 notional (~0.057 SOL) or request SOL from https://faucet.solana.com.`,
        });
        return;
      }

      const marketConfig = await fetchMarketConfig(connection).catch(
        () => null,
      );
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
          }),
        );
      } else if (marketConfig.isPaused) {
        setChainAction({
          state: "error",
          message: "The on-chain SOL-PERP market is currently paused.",
        });
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
        }),
      );

      const signature = await runOnChainAction(
        () =>
          simulateAndSendTransaction({
            connection,
            wallet,
            description: marketConfig
              ? "Create replay contract"
              : "Initialize market & create replay contract",
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
        message:
          err instanceof Error
            ? err.message
            : "Failed to create contract on chain.",
      });
    }
  };

  const handleAcceptOnChainContract = async () => {
    if (!wallet.publicKey || !onChainContractId) {
      setChainAction({
        state: "error",
        message: "Connect a risk-taker wallet to accept the contract.",
      });
      return;
    }
    if (onChainState && onChainState.buyer.equals(wallet.publicKey)) {
      setChainAction({
        state: "error",
        message:
          "Unauthorized (Anchor Error 6000): The offer creator (Buyer) cannot accept their own offer as Risk Taker. Please switch to Account 2 in your wallet, or click 'Auto-Accept as Demo Counterparty'.",
      });
      return;
    }
    const signature = await runOnChainAction(
      () =>
        simulateAndSendTransaction({
          connection,
          wallet,
          description: "Accept replay contract",
          instructions: [
            buildAcceptOfferIx({ contractPda, riskTaker: wallet.publicKey! }),
          ],
        }),
      "Risk taker accepted the replay contract.",
    );
    if (signature) await refreshOnChainState();
  };

  // 1-Click testnet demo counterparty matcher
  const handleAutoMatchWithDemoTaker = async () => {
    if (!wallet.publicKey || !onChainContractId || !onChainState) return;
    try {
      const demoKeypair = Keypair.generate();
      const neededRiskLamports = Number(
        onChainState.requiredRiskTakerCollateral -
          onChainState.depositedRiskTakerCollateral,
      );
      const neededBuyerLamports = Number(
        onChainState.requiredBuyerCollateral -
          onChainState.depositedBuyerCollateral,
      );

      const bal = await connection.getBalance(wallet.publicKey, "confirmed");
      const requiredFromWallet = neededRiskLamports + 2_500_000 + 5_000_000;
      if (bal < requiredFromWallet) {
        setChainAction({
          state: "error",
          message: `Insufficient Testnet SOL (balance: ${(bal / 1e9).toFixed(4)} SOL). Need ${(requiredFromWallet / 1e9).toFixed(4)} SOL to fund demo counterparty. Request free SOL at https://faucet.solana.com or reset with $50 notional.`,
        });
        return;
      }

      const instructions: TransactionInstruction[] = [
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: demoKeypair.publicKey,
          lamports: neededRiskLamports + 2_500_000,
        }),
        buildAcceptOfferIx({
          contractPda,
          riskTaker: demoKeypair.publicKey,
        }),
        buildDepositCollateralIx({
          contractPda,
          vaultPda,
          depositor: demoKeypair.publicKey,
          amountLamports: neededRiskLamports,
        }),
      ];

      // If buyer has not yet deposited, include buyer deposit in this exact same atomic transaction!
      if (
        neededBuyerLamports > 0 &&
        bal >= requiredFromWallet + neededBuyerLamports
      ) {
        instructions.push(
          buildDepositCollateralIx({
            contractPda,
            vaultPda,
            depositor: wallet.publicKey,
            amountLamports: neededBuyerLamports,
          }),
        );
      }

      const signature = await runOnChainAction(
        () =>
          simulateAndSendTransaction({
            connection,
            wallet,
            description: "Auto-match & deposit demo counterparty",
            instructions,
            additionalSigners: [demoKeypair],
          }),
        "Demo counterparty accepted and collateral deposited into vault PDA!",
      );

      if (signature) {
        const updated = await refreshOnChainState();
        if (updated?.lifecycleLabel === "Funded") setStep(3);
      }
    } catch (err) {
      setChainAction({
        state: "error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to auto-match demo counterparty.",
      });
    }
  };

  // Step 2: Deposit collateral
  const handleDepositBoth = async () => {
    if (onChainContractId) {
      if (!wallet.publicKey) {
        setChainAction({
          state: "error",
          message: "Connect your wallet to deposit collateral.",
        });
        return;
      }
      const account = await refreshOnChainState();
      if (!account) {
        setChainAction({
          state: "error",
          message: "Could not fetch contract account from Testnet.",
        });
        return;
      }
      const isBuyer = account.buyer.equals(wallet.publicKey);
      const isRiskTaker =
        !account.riskTaker.equals(PublicKey.default) &&
        account.riskTaker.equals(wallet.publicKey);
      if (!isBuyer && !isRiskTaker) {
        setChainAction({
          state: "error",
          message: "This wallet is not a registered party to this contract.",
        });
        return;
      }
      const amount = isBuyer
        ? account.requiredBuyerCollateral - account.depositedBuyerCollateral
        : account.requiredRiskTakerCollateral -
          account.depositedRiskTakerCollateral;
      if (amount <= BigInt(0)) {
        setChainAction({
          state: "error",
          message:
            "Required collateral for this wallet is already fully deposited.",
        });
        return;
      }

      // Pre-flight balance check: avoid raw insufficient lamports custom error 0x1
      const currentBal = await connection.getBalance(
        wallet.publicKey,
        "confirmed",
      );
      const requiredSolLamports = Number(amount) + 5_000_000;
      if (currentBal < requiredSolLamports) {
        setChainAction({
          state: "error",
          message: `Insufficient Testnet SOL (balance: ${(currentBal / 1e9).toFixed(4)} SOL). Depositing ${(Number(amount) / 1e9).toFixed(4)} SOL requires ${(requiredSolLamports / 1e9).toFixed(4)} SOL with fees. Top up at https://faucet.solana.com or reset with a $50 notional.`,
        });
        return;
      }

      const signature = await runOnChainAction(
        () =>
          simulateAndSendTransaction({
            connection,
            wallet,
            description: "Deposit replay collateral",
            instructions: [
              buildDepositCollateralIx({
                contractPda,
                vaultPda,
                depositor: wallet.publicKey!,
                amountLamports: Number(amount),
              }),
            ],
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
    const buyerDeposit = shortfallActive
      ? req.buyerCollateralCents - 5000
      : req.buyerCollateralCents;
    setBuyerDeposited(buyerDeposit);
    setTakerDeposited(req.riskTakerCollateralCents);
    setStep(3);
  };

  // Step 3: Activate
  const handleActivate = async () => {
    if (onChainContractId) {
      if (!wallet.publicKey) {
        setChainAction({
          state: "error",
          message: "Connect wallet to activate the funded contract.",
        });
        return;
      }
      const marketConfig = await fetchMarketConfig(connection).catch(
        () => null,
      );
      if (!marketConfig) {
        setChainAction({
          state: "error",
          message: "Market config could not be read from Testnet.",
        });
        return;
      }
      const signature = await runOnChainAction(
        () =>
          simulateAndSendTransaction({
            connection,
            wallet,
            description: "Activate replay contract",
            instructions: [
              buildActivateContractIx({
                contractPda,
                marketConfigPda: marketConfig.address,
                authority: wallet.publicKey!,
              }),
            ],
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
        setChainAction({
          state: "error",
          message: "Connect oracle wallet to publish observations.",
        });
        return;
      }
      const account = await refreshOnChainState();
      if (!account) return;
      const observation =
        BASELINE_DOCUMENTED_OBSERVATIONS[account.submittedObservationsCount];
      if (!observation) {
        setChainAction({
          state: "error",
          message: "All 21 observations have already been recorded.",
        });
        return;
      }
      const marketConfig = await fetchMarketConfig(connection).catch(
        () => null,
      );
      if (!marketConfig) return;
      const signature = await runOnChainAction(
        () =>
          simulateAndSendTransaction({
            connection,
            wallet,
            description: `Record funding observation #${observation.intervalIndex}`,
            instructions: [
              buildRecordObservationIx({
                contractPda,
                marketConfigPda: marketConfig.address,
                oracleAuthority: wallet.publicKey!,
                intervalIndex: observation.intervalIndex,
                realizedRatePpm: observation.ratePpm,
                recordedAt: Math.floor(Date.now() / 1000),
              }),
            ],
          }),
        `Observation #${observation.intervalIndex} recorded on Testnet.`,
      );
      if (signature) {
        const updated = await refreshOnChainState();
        if (
          updated &&
          updated.submittedObservationsCount >= updated.intervalCount
        )
          setStep(5);
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
          obs.ratePpm,
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
        setChainAction({
          state: "error",
          message: "Connect wallet to finalize the contract.",
        });
        return;
      }
      const account = await refreshOnChainState();
      if (!account) return;
      const signature = await runOnChainAction(
        () =>
          simulateAndSendTransaction({
            connection,
            wallet,
            description: "Finalize replay contract",
            instructions: [
              buildFinalizeContractIx({
                contractPda,
                vaultPda,
                buyer: account.buyer,
                riskTaker: account.riskTaker,
                caller: wallet.publicKey!,
              }),
            ],
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

  const busy = chainAction.state === "pending";
  const phaseNames = [
    "Agree terms",
    "Post collateral",
    "Activate",
    "Record funding",
    "Maturity",
    "Settlement",
  ];
  const phaseDescriptions = [
    "Choose the size and rate for your agreement.",
    "Both sides fund the collateral required by the contract.",
    "Confirm funding before the agreement becomes active.",
    "Record observed funding and track the settlement balance.",
    "All required intervals must be present before settlement.",
    "The net difference is paid and excess collateral returned.",
  ];
  const actualTotal = records.reduce(
    (total, record) => total + record.actualCost,
    0,
  );
  const currentBuyer = Boolean(
    onChainState &&
    wallet.publicKey &&
    onChainState.buyer.equals(wallet.publicKey),
  );
  const statuses = [
    "Open",
    "Matched",
    "Funded",
    "Active",
    "Matured",
    "Settled",
  ];

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="FOLLOW THE AGREEMENT"
        title="Contract flow"
        description="Walk through a funding hedge, from the first agreement to the final settlement."
        actions={
          <>
            <SegmentedControl
              label="Execution mode"
              value={executionMode}
              options={[
                { value: "simulation", label: "Walkthrough" },
                { value: "onchain", label: "Solana Testnet" },
              ]}
              onChange={(value) => {
                if (busy) return;
                setExecutionMode(value);
                handleReset();
                if (value === "onchain" && notionalDollars > 100)
                  setNotionalDollars(50);
              }}
            />
            <button
              className="app-button app-button-secondary"
              onClick={handleReset}
              disabled={busy}
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </>
        }
      />
      <ol className="flow-steps" aria-label="Contract progress">
        {phaseNames.map((title, index) => (
          <li
            key={title}
            className="flow-step"
            data-state={
              step === index + 1
                ? "current"
                : step > index + 1
                  ? "complete"
                  : "upcoming"
            }
            aria-current={step === index + 1 ? "step" : undefined}
          >
            <span>
              {step > index + 1 ? (
                <Check size={12} />
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </span>
            <span>{title}</span>
          </li>
        ))}
      </ol>
      {chainAction.message && (
        <Notice
          tone={
            chainAction.state === "error"
              ? "error"
              : chainAction.state === "success"
                ? "success"
                : "info"
          }
          onDismiss={() => setChainAction({ state: "idle", message: "" })}
        >
          {chainAction.message}
        </Notice>
      )}
      <div className="flow-layout">
        <div className="app-stack">
          <Panel
            className="flow-main"
            title={`Step ${step} of 6`}
            action={
              <span
                className={`app-badge${step === 6 ? " app-badge-accent" : ""}`}
              >
                {onChainState?.lifecycleLabel ?? statuses[step - 1]}
              </span>
            }
          >
            {step === 1 && (
              <>
                <div>
                  <h3>Start with your terms.</h3>
                  <p>
                    {phaseDescriptions[0]} The walkthrough uses a long position
                    and a fixed rate of 0.02% per interval.
                  </p>
                </div>
                <div className="flow-terms">
                  <div>
                    <span>Position</span>
                    <strong>Long SOL-PERP</strong>
                  </div>
                  <div>
                    <span>Notional size</span>
                    <strong>{formatCurrency(terms.notionalCents)}</strong>
                  </div>
                  <div>
                    <span>Fixed rate / 8h</span>
                    <strong className="app-accent">
                      {formatRatePercent(terms.fixedRatePpm)}
                    </strong>
                  </div>
                  <div>
                    <span>Contract duration</span>
                    <strong>7 days · 21 intervals</strong>
                  </div>
                </div>
                <div className="app-field">
                  <span className="app-field-label">
                    Choose a notional size
                  </span>
                  <div className="app-presets">
                    {(executionMode === "onchain"
                      ? [25, 50, 100, 250]
                      : [1000, 5000, 10000, 25000]
                    ).map((amount) => (
                      <button
                        key={amount}
                        aria-pressed={notionalDollars === amount}
                        onClick={() => setNotionalDollars(amount)}
                      >
                        ${amount.toLocaleString("en-US")}
                      </button>
                    ))}
                  </div>
                </div>
                {executionMode === "onchain" && (
                  <Notice>
                    Testnet mode creates a real contract using Testnet SOL.{" "}
                    {walletBalanceLamports !== null
                      ? `Connected balance: ${(walletBalanceLamports / 1e9).toFixed(4)} SOL.`
                      : "Connect a wallet to get started."}
                  </Notice>
                )}
                <div>
                  <button
                    className="app-button app-button-primary"
                    onClick={
                      executionMode === "simulation"
                        ? handleStartSimulatedWalkthrough
                        : handleCreateOnChainContract
                    }
                    disabled={busy}
                  >
                    {executionMode === "simulation" ? (
                      <Play size={14} />
                    ) : (
                      <Wallet size={14} />
                    )}{" "}
                    {busy
                      ? "Preparing contract…"
                      : executionMode === "simulation"
                        ? "Start walkthrough"
                        : "Create Testnet contract"}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div>
                  <h3>Fund both sides of the hedge.</h3>
                  <p>
                    Collateral covers each side’s maximum exposure within the
                    permitted rate bounds, with a 5% buffer.
                  </p>
                </div>
                <div className="flow-terms">
                  <div>
                    <span>Hedger collateral estimate</span>
                    <strong>{formatCurrency(req.buyerCollateralCents)}</strong>
                  </div>
                  <div>
                    <span>Counterparty collateral estimate</span>
                    <strong>
                      {formatCurrency(req.riskTakerCollateralCents)}
                    </strong>
                  </div>
                </div>
                {executionMode === "simulation" ? (
                  <>
                    <div className="app-row-between">
                      <span className="app-small app-secondary">
                        Test an underfunded deposit
                      </span>
                      <button
                        className="app-button app-button-secondary"
                        aria-pressed={shortfallActive}
                        onClick={() => setShortfallActive((value) => !value)}
                      >
                        {shortfallActive
                          ? "Shortfall enabled · −$50"
                          : "Enable shortfall"}
                      </button>
                    </div>
                    <div>
                      <button
                        className="app-button app-button-primary"
                        onClick={handleDepositBoth}
                      >
                        Simulate both deposits <ArrowRight size={14} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {onChainState && (
                      <dl className="app-detail-list">
                        <div>
                          <dt>Connected role</dt>
                          <dd>{currentBuyer ? "Hedger" : "Counterparty"}</dd>
                        </div>
                        <div>
                          <dt>Hedger deposit</dt>
                          <dd>
                            {(
                              Number(onChainState.depositedBuyerCollateral) /
                              1e9
                            ).toFixed(4)}{" "}
                            /{" "}
                            {(
                              Number(onChainState.requiredBuyerCollateral) / 1e9
                            ).toFixed(4)}{" "}
                            SOL
                          </dd>
                        </div>
                        <div>
                          <dt>Counterparty deposit</dt>
                          <dd>
                            {(
                              Number(
                                onChainState.depositedRiskTakerCollateral,
                              ) / 1e9
                            ).toFixed(4)}{" "}
                            /{" "}
                            {(
                              Number(onChainState.requiredRiskTakerCollateral) /
                              1e9
                            ).toFixed(4)}{" "}
                            SOL
                          </dd>
                        </div>
                      </dl>
                    )}
                    <div className="app-row">
                      {onChainState?.lifecycleLabel === "Open" &&
                      currentBuyer ? (
                        <>
                          <button
                            className="app-button app-button-primary"
                            onClick={handleDepositBoth}
                            disabled={busy}
                          >
                            Deposit hedger collateral
                          </button>
                          <button
                            className="app-button app-button-secondary"
                            onClick={handleAutoMatchWithDemoTaker}
                            disabled={busy}
                          >
                            Match & fund a demo counterparty
                          </button>
                        </>
                      ) : onChainState?.lifecycleLabel === "Open" ? (
                        <button
                          className="app-button app-button-primary"
                          onClick={handleAcceptOnChainContract}
                          disabled={busy}
                        >
                          Accept as counterparty <ArrowRight size={14} />
                        </button>
                      ) : (
                        <button
                          className="app-button app-button-primary"
                          onClick={handleDepositBoth}
                          disabled={busy}
                        >
                          Deposit this wallet’s collateral{" "}
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                    {currentBuyer && (
                      <p>
                        The demo counterparty action funds a separate Testnet
                        signer using this wallet. Review the transaction in your
                        wallet before approving.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
            {step === 3 && (
              <>
                <div>
                  <h3>Ready for activation.</h3>
                  <p>
                    Once activated, the rate and duration are locked for the
                    agreed term. Mid-cycle withdrawals are not available.
                  </p>
                </div>
                {shortfallActive ? (
                  <Notice tone="error">
                    <strong>Collateral is short by $50.</strong> Activation is
                    blocked until the remaining deposit is funded.
                  </Notice>
                ) : (
                  <Notice tone="success">
                    <strong>Both sides are funded.</strong> The agreement can
                    now be activated.
                  </Notice>
                )}
                <dl className="app-detail-list">
                  <div>
                    <dt>Hedger deposit</dt>
                    <dd>{formatCurrency(buyerDeposited)}</dd>
                  </div>
                  <div>
                    <dt>Counterparty deposit</dt>
                    <dd>{formatCurrency(takerDeposited)}</dd>
                  </div>
                  <div>
                    <dt>Total collateral</dt>
                    <dd>{formatCurrency(buyerDeposited + takerDeposited)}</dd>
                  </div>
                </dl>
                <div>
                  {shortfallActive ? (
                    <button
                      className="app-button app-button-primary"
                      onClick={() => {
                        setShortfallActive(false);
                        setBuyerDeposited(req.buyerCollateralCents);
                      }}
                    >
                      Top up the remaining $50 <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      className="app-button app-button-primary"
                      onClick={handleActivate}
                      disabled={busy}
                    >
                      <LockKeyhole size={14} />
                      Activate contract <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </>
            )}
            {step >= 4 && (
              <>
                <div>
                  {isFinalized && (
                    <div
                      className="flow-success-icon"
                      style={{ marginBottom: 15 }}
                    >
                      <CheckCircle2 size={23} />
                    </div>
                  )}
                  <h3>
                    {step === 6
                      ? "The agreement is settled."
                      : step === 5
                        ? "Your hedge has reached maturity."
                        : "Track each funding interval."}
                  </h3>
                  <p>{phaseDescriptions[step - 1]}</p>
                </div>
                <div className="app-stack-small">
                  <div className="app-row-between">
                    <span className="app-small app-secondary">
                      Observations recorded
                    </span>
                    <span className="app-small app-number">
                      {records.length} / 21
                    </span>
                  </div>
                  <div
                    className="flow-progress"
                    role="progressbar"
                    aria-label="Funding observations recorded"
                    aria-valuemin={0}
                    aria-valuemax={21}
                    aria-valuenow={records.length}
                  >
                    <span
                      style={{ width: `${(records.length / 21) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flow-terms">
                  <div>
                    <span>Exchange funding</span>
                    <strong>{formatCurrency(actualTotal)}</strong>
                  </div>
                  <div>
                    <span>Accumulated offset</span>
                    <strong className="app-accent">
                      {formatCurrency(accumulatedSettlementCents, true)}
                    </strong>
                  </div>
                </div>
                {step === 4 && (
                  <>
                    <div className="app-row">
                      {!onChainContractId && (
                        <button
                          className="app-button app-button-primary"
                          onClick={() => setIsPlayingAuto((value) => !value)}
                        >
                          {isPlayingAuto ? (
                            <Pause size={14} />
                          ) : (
                            <Play size={14} />
                          )}{" "}
                          {isPlayingAuto
                            ? "Pause replay"
                            : "Auto-publish intervals"}
                        </button>
                      )}
                      <button
                        className="app-button app-button-secondary"
                        onClick={handlePublishNext}
                        disabled={isPlayingAuto || busy}
                      >
                        {onChainContractId
                          ? "Publish next observation"
                          : "Publish one interval"}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                    {!onChainContractId && (
                      <div className="app-row-between">
                        <span className="app-small app-muted">
                          Edge case: omit observation #15
                        </span>
                        <button
                          className="app-button app-button-ghost"
                          disabled={publishedCount > 0}
                          aria-pressed={missingObsActive}
                          onClick={() => setMissingObsActive((value) => !value)}
                        >
                          {missingObsActive
                            ? "Missing observation enabled"
                            : "Enable edge case"}
                        </button>
                      </div>
                    )}
                  </>
                )}
                {missingObsActive && publishedCount >= 15 && (
                  <Notice tone="error">
                    <strong>Observation #15 is missing.</strong> Settlement is
                    blocked. Reset the walkthrough to run a complete dataset.
                  </Notice>
                )}
                {records.length > 0 && (
                  <div className="flow-ledger">
                    <table className="app-table">
                      <thead>
                        <tr>
                          <th>Interval</th>
                          <th>Observed rate</th>
                          <th>Offset</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.index}>
                            <td>#{record.index + 1}</td>
                            <td>{formatRatePercent(record.ratePpm)}</td>
                            <td className="app-accent">
                              {formatCurrency(record.settlement, true)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {step === 5 && !isFinalized && (
                  <div>
                    <button
                      className="app-button app-button-primary"
                      onClick={handleFinalize}
                      disabled={missingObsActive || busy}
                    >
                      <ShieldCheck size={15} />
                      Settle the contract <ArrowRight size={14} />
                    </button>
                  </div>
                )}
                {isFinalized && (
                  <>
                    <dl className="app-detail-list">
                      <div>
                        <dt>Hedger collateral returned + settlement</dt>
                        <dd>
                          {formatCurrency(
                            req.buyerCollateralCents +
                              accumulatedSettlementCents,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Counterparty collateral − settlement</dt>
                        <dd>
                          {formatCurrency(
                            req.riskTakerCollateralCents -
                              accumulatedSettlementCents,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Net funding cost for the hedger</dt>
                        <dd className="app-accent">
                          {formatCurrency(
                            actualTotal - accumulatedSettlementCents,
                          )}
                        </dd>
                      </div>
                    </dl>
                    <Notice tone="success">
                      {formatCurrency(actualTotal)} in exchange funding −{" "}
                      {formatCurrency(accumulatedSettlementCents)} in settlement
                      ={" "}
                      {formatCurrency(actualTotal - accumulatedSettlementCents)}{" "}
                      net funding cost.
                    </Notice>
                  </>
                )}
              </>
            )}
          </Panel>
          <details className="app-disclosure">
            <summary>
              <span>
                <Layers size={15} />
                Contract addresses
              </span>
              <ChevronDown size={16} />
            </summary>
            <div className="flow-addresses">
              {[
                { label: "Program", address: PROGRAM_ID.toBase58() },
                { label: "Contract account", address: contractPda.toBase58() },
                { label: "Collateral vault", address: vaultPda.toBase58() },
              ].map((item) => (
                <div key={item.label}>
                  <span className="app-section-label">{item.label}</span>
                  <a
                    href={`https://explorer.solana.com/address/${item.address}?cluster=testnet`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <code>{item.address}</code>
                  </a>
                </div>
              ))}
            </div>
          </details>
        </div>
        <div className="app-stack">
          <Panel title="Agreement summary" className="flow-summary">
            <dl className="app-detail-list">
              <div>
                <dt>Market</dt>
                <dd>SOL-PERP</dd>
              </div>
              <div>
                <dt>Position</dt>
                <dd>Long</dd>
              </div>
              <div>
                <dt>Notional</dt>
                <dd>{formatCurrency(terms.notionalCents)}</dd>
              </div>
              <div>
                <dt>Fixed rate / 8h</dt>
                <dd className="app-accent">
                  {formatRatePercent(terms.fixedRatePpm)}
                </dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>7 days</dd>
              </div>
              <div>
                <dt>Rate bounds</dt>
                <dd>±0.50%</dd>
              </div>
            </dl>
            <div className="flow-state">
              <span className="app-badge app-badge-accent">
                <CircleCheck size={12} />
                {executionMode === "simulation"
                  ? "Simulated walkthrough"
                  : "Solana Testnet"}
              </span>
            </div>
          </Panel>
          <Notice>
            {executionMode === "simulation" ? (
              <>
                <strong>Learn at your own pace.</strong> This walkthrough uses
                example data and requires no wallet or funds.
              </>
            ) : (
              <>
                <strong>Testnet environment.</strong> Wallet approval is
                required for contract interactions.{" "}
                <a
                  href="https://faucet.solana.com"
                  target="_blank"
                  rel="noreferrer"
                  className="app-accent"
                >
                  Get Testnet SOL ↗
                </a>
              </>
            )}
          </Notice>
        </div>
      </div>
    </div>
  );
};
