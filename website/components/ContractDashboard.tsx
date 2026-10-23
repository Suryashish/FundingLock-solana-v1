"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  PROGRAM_ID,
  getCounterPda,
  createInitializeInstruction,
  createIncrementInstruction,
  fetchCounterState,
  CounterState,
} from "@/lib/contract";
import {
  Shield,
  Activity,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  Plus,
  Play,
  Lock,
  Layers,
  Sparkles,
  ArrowRight,
  UserCheck,
} from "lucide-react";

export const ContractDashboard = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [counterPda, setCounterPda] = useState<string>("");
  const [contractState, setContractState] = useState<CounterState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Derive PDA on mount
  useEffect(() => {
    try {
      getCounterPda().then(([pda]) => {
        setCounterPda(pda.toBase58());
      });
    } catch (e) {
      console.error("PDA derivation error", e);
    }
  }, []);

  // Fetch current on-chain state
  const loadState = useCallback(async () => {
    try {
      setLoading(true);
      const state = await fetchCounterState(connection);
      setContractState(state);
    } catch (err: unknown) {
      console.error("Failed to load counter state", err);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Execute Initialize instruction
  const handleInitialize = async () => {
    if (!publicKey || !connected) {
      setErrorMessage("Please connect your wallet first.");
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setTxSignature(null);
    setActionLoading("initialize");

    try {
      const [pda] = await getCounterPda();
      const ix = createInitializeInstruction(publicKey, pda);
      const tx = new Transaction().add(ix);

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signature = await sendTransaction(tx, connection, {
        preflightCommitment: "confirmed",
      });

      setTxSignature(signature);

      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      setSuccessMessage(
        "Counter successfully initialized on Solana Testnet! Authority set to your wallet."
      );
      await loadState();
    } catch (err: unknown) {
      console.error("Initialize failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already in use")) {
        setErrorMessage("Account is already initialized on-chain.");
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Execute Increment instruction
  const handleIncrement = async () => {
    if (!publicKey || !connected) {
      setErrorMessage("Please connect your wallet first.");
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setTxSignature(null);
    setActionLoading("increment");

    try {
      const [pda] = await getCounterPda();
      const ix = createIncrementInstruction(publicKey, pda);
      const tx = new Transaction().add(ix);

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signature = await sendTransaction(tx, connection, {
        preflightCommitment: "confirmed",
      });

      setTxSignature(signature);

      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      setSuccessMessage("Counter incremented by 1 successfully!");
      await loadState();
    } catch (err: unknown) {
      console.error("Increment failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Unauthorized") || msg.includes("0x1770")) {
        setErrorMessage(
          "Unauthorized: Only the designated counter authority can increment this counter."
        );
      } else if (msg.includes("CounterOverflow") || msg.includes("0x1771")) {
        setErrorMessage(
          "Counter Overflow: The counter has reached its maximum limit (10)."
        );
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const isAuthority =
    connected &&
    publicKey &&
    contractState?.authority &&
    publicKey.toBase58() === contractState.authority;

  return (
    <div className="space-y-8">
      {/* Hero / Overview Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-zinc-800 p-6 md:p-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Anchor Smart Contract Deployed & Verified</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              FundingLock Contract Interface
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Interact directly with the on-chain Anchor program deployed on
              Solana Testnet. Test account initialization, state management via
              PDA (Program Derived Address), and authorized state mutations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={loadState}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition border border-zinc-700/60 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`}
              />
              <span>Refresh On-Chain</span>
            </button>
            <a
              href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium transition border border-emerald-500/20"
            >
              <span>Solana Explorer</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Transaction Status Alerts */}
      {successMessage && (
        <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-emerald-300">{successMessage}</p>
            {txSignature && (
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline font-mono"
              >
                <span>View Tx on Explorer: {txSignature.slice(0, 16)}...</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl bg-rose-950/40 border border-rose-500/30 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-rose-300">Transaction Failed</p>
            <p className="text-xs text-rose-300/80 break-all">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Grid: Account State & Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Live Counter State */}
        <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/80 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                State: Counter
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                  contractState?.isInitialized
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}
              >
                {loading
                  ? "Fetching..."
                  : contractState?.isInitialized
                  ? "Initialized"
                  : "Uninitialized"}
              </span>
            </div>

            <div className="pt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black tracking-tight text-white font-mono">
                  {contractState?.isInitialized ? contractState.count : "—"}
                </span>
                <span className="text-zinc-500 font-mono text-lg">/ 10 max</span>
              </div>
              <p className="text-xs text-zinc-400 mt-2">
                State stored on-chain inside the program PDA account.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/80">
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    contractState?.isInitialized
                      ? Math.min(100, (contractState.count / 10) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: PDA & Rent Balance */}
        <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/80 p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Account Metadata
            </span>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Counter PDA</span>
                <button
                  onClick={() => copyToClipboard(counterPda, "pda")}
                  className="hover:text-zinc-200 transition text-[11px] flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedKey === "pda" ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <p className="text-xs font-mono text-zinc-200 bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/60 truncate">
                {counterPda || "Loading..."}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Authority Address</span>
                {contractState?.authority && (
                  <button
                    onClick={() =>
                      copyToClipboard(contractState.authority, "authority")
                    }
                    className="hover:text-zinc-200 transition text-[11px] flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedKey === "authority" ? "Copied" : "Copy"}</span>
                  </button>
                )}
              </div>
              <p className="text-xs font-mono text-zinc-200 bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/60 truncate">
                {contractState?.authority || "Not initialized yet"}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
            <span className="text-zinc-400">Account Rent:</span>
            <span className="font-mono text-zinc-200">
              {contractState?.lamports
                ? `${(contractState.lamports / LAMPORTS_PER_SOL).toFixed(
                    5
                  )} SOL`
                : "0 SOL"}
            </span>
          </div>
        </div>

        {/* Card 3: Connected Authority Verification */}
        <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/80 p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Authority Permission
            </span>

            {connected ? (
              <div className="space-y-3">
                <div
                  className={`p-3 rounded-xl border flex items-center gap-3 ${
                    isAuthority
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-zinc-950/50 border-zinc-800 text-zinc-400"
                  }`}
                >
                  <UserCheck
                    className={`w-5 h-5 shrink-0 ${
                      isAuthority ? "text-emerald-400" : "text-zinc-500"
                    }`}
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-white">
                      {isAuthority
                        ? "You are the Designated Authority"
                        : "Different Wallet Connected"}
                    </p>
                    <p className="text-zinc-400 text-[11px]">
                      {isAuthority
                        ? "You have permission to call increment()."
                        : contractState?.isInitialized
                        ? "Only the initializer can increment."
                        : "Initialize to claim authority."}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-500">
                  <span className="font-semibold text-zinc-400">Connected:</span>{" "}
                  <span className="font-mono">{publicKey?.toBase58().slice(0, 16)}...</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-center space-y-2">
                <Lock className="w-5 h-5 text-zinc-500 mx-auto" />
                <p className="text-xs text-zinc-400">
                  Connect your wallet using the top-right button to invoke
                  contract instructions.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-500 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Guarded with require_keys_eq! on-chain</span>
          </div>
        </div>
      </div>

      {/* Contract Instruction Actions Section */}
      <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-6 md:p-8 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <span>Execute Contract Instructions</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Build and submit signed transactions directly to the deployed Anchor
            program on Solana Testnet.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Action 1: Initialize */}
          <div className="rounded-xl bg-zinc-950/60 border border-zinc-800 p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-400" />
                  <span>1. initialize()</span>
                </h3>
                <span className="text-[11px] font-mono text-zinc-500">
                  Discriminator: 0xafaf6d1f...
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Allocates the Counter PDA account with space for 8-byte
                discriminator + Counter struct, seeds `count = 0`, deposits 1
                lamport via CPI, and sets your wallet as the authorized manager.
              </p>
            </div>

            <button
              onClick={handleInitialize}
              disabled={
                !connected ||
                actionLoading !== null ||
                contractState?.isInitialized === true
              }
              className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition shadow-md ${
                contractState?.isInitialized
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/40"
                  : !connected
                  ? "bg-zinc-800/60 text-zinc-500 cursor-not-allowed border border-zinc-800"
                  : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/10 cursor-pointer"
              }`}
            >
              {actionLoading === "initialize" ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting to Testnet...</span>
                </>
              ) : contractState?.isInitialized ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Already Initialized</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Initialize Counter</span>
                </>
              )}
            </button>
          </div>

          {/* Action 2: Increment */}
          <div className="rounded-xl bg-zinc-950/60 border border-zinc-800 p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4 text-teal-400" />
                  <span>2. increment()</span>
                </h3>
                <span className="text-[11px] font-mono text-zinc-500">
                  Discriminator: 0x0b126809...
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Validates that the signer matches `counter.authority`, ensures{" "}
                `count &lt; 10`, increments the value, and emits an on-chain
                event log: `Hello, world! Counter is now &#123;count&#125;`.
              </p>
            </div>

            <button
              onClick={handleIncrement}
              disabled={
                !connected ||
                actionLoading !== null ||
                !contractState?.isInitialized ||
                (contractState?.isInitialized && !isAuthority) ||
                (contractState?.count ?? 0) >= 10
              }
              className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition shadow-md ${
                !contractState?.isInitialized
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800"
                  : !isAuthority
                  ? "bg-zinc-800/80 text-zinc-500 cursor-not-allowed border border-zinc-800"
                  : (contractState?.count ?? 0) >= 10
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800"
                  : "bg-teal-500 hover:bg-teal-400 text-zinc-950 shadow-teal-500/10 cursor-pointer"
              }`}
            >
              {actionLoading === "increment" ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Incrementing...</span>
                </>
              ) : !contractState?.isInitialized ? (
                <span>Initialize First</span>
              ) : !isAuthority ? (
                <span>Signer is Not Authority</span>
              ) : (contractState?.count ?? 0) >= 10 ? (
                <span>Max Count Reached (10)</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Increment Counter (+1)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* FundingLock Protocol Roadmap Notice */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>FundingLock Architecture Next Steps</span>
          </div>
          <p className="text-xs text-zinc-400 max-w-2xl">
            This deployed program and verified frontend harness establish the core
            Solana testnet foundation. Next up according to `plan.md`: implementing
            the fixed vs realized funding rate escrow, collateral vault PDAs, and
            oracle settlement for perpetual traders.
          </p>
        </div>

        <div className="text-xs font-mono text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 shrink-0">
          Program: 78VTWQ...ksxx
        </div>
      </div>
    </div>
  );
};
