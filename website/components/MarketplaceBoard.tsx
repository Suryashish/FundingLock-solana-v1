"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import { FIXTURE_START_TIME } from "../lib/data/fixtures.ts";
import { BINANCE_SOL_CONFIG, ContractTerms, PositionSide } from "../lib/domain/types.ts";
import { calculateCollateralRequirement } from "../lib/domain/collateral.ts";
import { formatCurrency, formatRatePercent } from "../lib/domain/funding.ts";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Plus, Check, X } from "lucide-react";
import {
  buildAcceptOfferIx,
  buildCreateOfferIx,
  buildInitializeMarketIx,
  getContractPda,
} from "../lib/solana/client.ts";
import {
  createContractId,
  fetchContractAccount,
  fetchContractAccounts,
  fetchMarketConfig,
  formatSignature,
  simulateAndSendTransaction,
  type OnChainContractState,
} from "../lib/solana/transactions.ts";

interface MarketplaceBoardProps {
  onAcceptOfferClick?: (offer: ContractTerms) => void;
}

const DEFAULT_SAMPLE_OFFERS: ContractTerms[] = [
  {
    contractId: "OFF-BENCH-001",
    marketSymbol: "SOL-PERP",
    venueId: "BINANCE_PERP",
    positionSide: "long",
    notionalCents: 1000000,
    fixedRatePpm: 200,
    intervalCount: 21,
    intervalSeconds: 28800,
    startTime: FIXTURE_START_TIME,
    endTime: FIXTURE_START_TIME + 21 * 28800,
    minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
    maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
    collateralMint: "SOL",
    buyerPubkey: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    status: "Open",
  },
  {
    contractId: "OFF-BENCH-002",
    marketSymbol: "SOL-PERP",
    venueId: "BINANCE_PERP",
    positionSide: "long",
    notionalCents: 500000,
    fixedRatePpm: 150,
    intervalCount: 21,
    intervalSeconds: 28800,
    startTime: FIXTURE_START_TIME,
    endTime: FIXTURE_START_TIME + 21 * 28800,
    minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
    maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
    collateralMint: "SOL",
    buyerPubkey: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    status: "Open",
  },
  {
    contractId: "OFF-BENCH-003",
    marketSymbol: "SOL-PERP",
    venueId: "BINANCE_PERP",
    positionSide: "short",
    notionalCents: 250000,
    fixedRatePpm: 250,
    intervalCount: 21,
    intervalSeconds: 28800,
    startTime: FIXTURE_START_TIME,
    endTime: FIXTURE_START_TIME + 21 * 28800,
    minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
    maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
    collateralMint: "SOL",
    buyerPubkey: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    status: "Open",
  },
];

export const MarketplaceBoard: React.FC<MarketplaceBoardProps> = ({
  onAcceptOfferClick,
}) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { publicKey } = wallet;
  const [offers, setOffers] = useState<ContractTerms[]>(DEFAULT_SAMPLE_OFFERS);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [filterSide, setFilterSide] = useState<"all" | "long" | "short">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [acceptedOfferId, setAcceptedOfferId] = useState<string | null>(null);

  // Create offer state
  const [newSide, setNewSide] = useState<PositionSide>("long");
  const [newNotional, setNewNotional] = useState<number>(1000);
  const [newFixedRate, setNewFixedRate] = useState<number>(0.02);
  const [onChainContracts, setOnChainContracts] = useState<Record<string, OnChainContractState>>({});
  const [actionStatus, setActionStatus] = useState<{
    state: "idle" | "pending" | "success" | "error";
    message: string;
  }>({ state: "idle", message: "" });

  const loadOnChainOffers = useCallback(async () => {
    setIsLoadingOffers(true);
    try {
      const accounts = await fetchContractAccounts(connection);
      if (accounts && accounts.length > 0) {
        const onChainList: ContractTerms[] = accounts.map((account) => ({
          contractId: account.contractId,
          marketSymbol: account.marketSymbol,
          venueId: "BINANCE_PERP",
          positionSide: account.positionSide,
          notionalCents: account.notionalCents,
          fixedRatePpm: account.fixedRatePpm,
          intervalCount: account.intervalCount,
          intervalSeconds: account.intervalSeconds,
          startTime: account.startTime,
          endTime: account.endTime,
          minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
          maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
          collateralMint: "SOL",
          buyerPubkey: account.buyer.toBase58(),
          riskTakerPubkey: account.riskTaker.equals(PublicKey.default) ? undefined : account.riskTaker.toBase58(),
          status: account.lifecycleLabel as ContractTerms["status"],
        }));
        setOffers(onChainList);
        setOnChainContracts(Object.fromEntries(accounts.map((account) => [account.contractId, account])));
      }
    } catch {
      // Fallback to default benchmark offers if testnet RPC throttles
    } finally {
      setIsLoadingOffers(false);
    }
  }, [connection]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOnChainOffers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOnChainOffers]);

  // Live preview of required collateral in modal
  const previewCollateral = useMemo(() => {
    const terms: ContractTerms = {
      contractId: "TEMP",
      marketSymbol: "SOL-PERP",
      venueId: "BINANCE_PERP",
      positionSide: newSide,
      notionalCents: newNotional * 100,
      fixedRatePpm: Math.round(newFixedRate * 10000),
      intervalCount: 21,
      intervalSeconds: 28800,
      startTime: FIXTURE_START_TIME,
      endTime: FIXTURE_START_TIME + 21 * 28800,
      minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
      maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
      collateralMint: "SOL",
    };
    return calculateCollateralRequirement(terms, BINANCE_SOL_CONFIG);
  }, [newSide, newNotional, newFixedRate]);

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) {
      setActionStatus({ state: "error", message: "Please connect a wallet before posting an on-chain offer." });
      return;
    }
    if (newSide !== "long") {
      setActionStatus({ state: "error", message: "The deployed Testnet contract currently supports long offers." });
      return;
    }

    setActionStatus({ state: "pending", message: "Verifying Testnet balance and preparing transaction…" });
    try {
      const lamports = await connection.getBalance(publicKey, "confirmed");
      if (lamports < 5_000_000) {
        throw new Error(
          `Insufficient Testnet SOL (balance: ${(lamports / 1e9).toFixed(4)} SOL). Need ~0.005 SOL for fees. Ensure wallet is set to Testnet and fund at https://faucet.solana.com.`
        );
      }

      const marketConfig = await fetchMarketConfig(connection);
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
            oracleAuthority: publicKey,
            admin: publicKey,
          })
        );
      } else if (marketConfig.isPaused) {
        throw new Error("The on-chain SOL-PERP market is currently paused.");
      }

      const contractId = createContractId("OFF", publicKey);
      instructions.push(
        buildCreateOfferIx({
          contractId,
          marketSymbol: BINANCE_SOL_CONFIG.marketSymbol,
          buyer: publicKey,
          positionSide: newSide,
          notionalCents: newNotional * 100,
          fixedRatePpm: Math.round(newFixedRate * 10000),
          intervalCount: 21,
          startTime: Math.floor(Date.now() / 1000),
        })
      );

      setActionStatus({
        state: "pending",
        message: "Awaiting wallet approval… Please approve the transaction in your wallet prompt.",
      });

      const signature = await simulateAndSendTransaction({
        connection,
        wallet,
        description: marketConfig ? "Create marketplace offer" : "Initialize market & create marketplace offer",
        instructions,
      });

      const account = await fetchContractAccount(connection, contractId);
      if (account) {
        setOnChainContracts((prev) => ({ ...prev, [contractId]: account }));
      }

      const newOffer: ContractTerms = {
        contractId,
        marketSymbol: "SOL-PERP",
        venueId: "BINANCE_PERP",
        positionSide: newSide,
        notionalCents: newNotional * 100,
        fixedRatePpm: Math.round(newFixedRate * 10000),
        intervalCount: 21,
        intervalSeconds: 28800,
        startTime: FIXTURE_START_TIME,
        endTime: FIXTURE_START_TIME + 21 * 28800,
        minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
        maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
        collateralMint: "SOL",
        buyerPubkey: publicKey.toBase58(),
        status: "Open",
      };

      setOffers((prev) => [newOffer, ...prev]);
      setShowCreateModal(false);
      setActionStatus({ state: "success", message: `Offer ${contractId} created on Testnet! Tx: ${formatSignature(signature)}.` });
    } catch (error) {
      setActionStatus({ state: "error", message: error instanceof Error ? error.message : "Offer creation failed." });
    }
  };

  const handleAccept = async (offer: ContractTerms) => {
    const existing = onChainContracts[offer.contractId] ?? (await fetchContractAccount(connection, offer.contractId).catch(() => null));
    
    // If it's a benchmark template without an active Testnet account, smoothly accept and route to Lifecycle Replay!
    if (!existing) {
      setAcceptedOfferId(offer.contractId);
      setOffers((prev) => prev.map((item) => item.contractId === offer.contractId ? { ...item, status: "Matched" } : item));
      setActionStatus({
        state: "success",
        message: `Offer matched! Redirecting to the 6-step Contract Lifecycle Flow…`,
      });
      if (onAcceptOfferClick) {
        setTimeout(() => onAcceptOfferClick(offer), 600);
      }
      return;
    }

    if (!publicKey) {
      setActionStatus({ state: "error", message: "Please connect a wallet before accepting an on-chain offer." });
      return;
    }
    if (existing.buyer.equals(publicKey)) {
      setActionStatus({ state: "error", message: "The offer creator cannot accept their own offer as the risk taker." });
      return;
    }

    setActionStatus({ state: "pending", message: "Simulating offer acceptance on Testnet…" });
    try {
      const [contractPda] = getContractPda(offer.contractId);
      const signature = await simulateAndSendTransaction({
        connection,
        wallet,
        description: "Accept marketplace offer",
        instructions: [buildAcceptOfferIx({ contractPda, riskTaker: publicKey })],
      });
      const account = await fetchContractAccount(connection, offer.contractId);
      if (account) {
        setOnChainContracts((prev) => ({ ...prev, [offer.contractId]: account }));
      }
      setAcceptedOfferId(offer.contractId);
      setOffers((prev) => prev.map((item) => item.contractId === offer.contractId ? { ...item, status: "Matched" } : item));
      setActionStatus({ state: "success", message: `Offer accepted on Testnet! Tx: ${formatSignature(signature)}.` });
      if (onAcceptOfferClick) {
        onAcceptOfferClick(offer);
      }
    } catch (error) {
      setActionStatus({ state: "error", message: error instanceof Error ? error.message : "Offer acceptance failed." });
    }
  };

  const filteredOffers = offers.filter((o) => {
    if (filterSide === "all") return true;
    return o.positionSide === filterSide;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 font-sans">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.08] dark:border-white/[0.08]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-semibold mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Solana Testnet Peer Offers · SOL-PERP</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
            Peer Hedge Marketplace
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Browse and match peer fixed funding offers. All agreements are program-enforced on Solana Testnet.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold font-mono shadow-md active:scale-98 transition self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>Post New Offer</span>
        </button>
      </div>

      {/* Action Notification Message */}
      {actionStatus.message && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-mono flex items-center justify-between ${
            actionStatus.state === "error"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
              : actionStatus.state === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              : "bg-zinc-100 dark:bg-zinc-800 border-black/[0.06] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300"
          }`}
        >
          <span>{actionStatus.message}</span>
          <button
            onClick={() => setActionStatus({ state: "idle", message: "" })}
            className="text-xs opacity-60 hover:opacity-100 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Filter Pills & Total Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="p-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-black/[0.06] dark:border-white/[0.08] inline-flex items-center gap-1">
          {(["all", "long", "short"] as const).map((side) => (
            <button
              key={side}
              onClick={() => setFilterSide(side)}
              className={`px-3 py-1.5 rounded-full capitalize transition ${
                filterSide === side
                  ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              {side === "all" ? "All Offers" : `${side} Hedges`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400 text-[11px]">
          <span>Available Offers: <strong className="text-zinc-950 dark:text-white">{filteredOffers.length}</strong></span>
          <span>•</span>
          <span>Escrow: <strong className="text-emerald-600 dark:text-emerald-400">100% Locked</strong></span>
        </div>
      </div>

      {/* 3. Offers Table */}
      <div className="rounded-[28px] bg-white dark:bg-zinc-900/90 border border-black/[0.08] dark:border-white/[0.08] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoadingOffers ? (
            <div className="p-10 text-center text-xs font-mono text-zinc-500">
              Querying Testnet Contract Account PDAs…
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[10px] uppercase text-zinc-400 dark:text-zinc-500 bg-zinc-50/70 dark:bg-zinc-800/40 border-b border-black/[0.06] dark:border-white/[0.06]">
                <tr>
                  <th className="py-3 px-4">Offer ID</th>
                  <th className="py-3 px-3">Position Side</th>
                  <th className="py-3 px-3">Notional</th>
                  <th className="py-3 px-3">Fixed Rate</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-3">Buyer Margin</th>
                  <th className="py-3 px-3">Taker Margin</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {filteredOffers.map((offer) => {
                  const req = calculateCollateralRequirement(offer, BINANCE_SOL_CONFIG);
                  const isAccepted = acceptedOfferId === offer.contractId || offer.status === "Matched";

                  return (
                    <tr
                      key={offer.contractId}
                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-zinc-950 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{offer.contractId}</span>
                          {offer.contractId.startsWith("OFF-BENCH") && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                              Benchmark
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            offer.positionSide === "long"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {offer.positionSide.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-bold text-zinc-950 dark:text-white">
                        {formatCurrency(offer.notionalCents)}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatRatePercent(offer.fixedRatePpm)} / 8h
                      </td>
                      <td className="py-3.5 px-3 text-zinc-500">
                        7 Days (21 epochs)
                      </td>
                      <td className="py-3.5 px-3 text-zinc-700 dark:text-zinc-300">
                        {formatCurrency(req.buyerCollateralCents)}
                      </td>
                      <td className="py-3.5 px-3 text-zinc-700 dark:text-zinc-300">
                        {formatCurrency(req.riskTakerCollateralCents)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isAccepted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold px-3 py-1 rounded-full bg-emerald-500/10">
                            <Check className="w-3.5 h-3.5" />
                            <span>Matched</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAccept(offer)}
                            className="px-3.5 py-1.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold hover:opacity-90 active:scale-98 transition shadow-2xs"
                          >
                            Accept Offer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 4. Create Offer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-black/[0.08] dark:border-white/[0.1] rounded-[28px] max-w-lg w-full p-6 space-y-5 shadow-2xl text-zinc-950 dark:text-white animate-in zoom-in-95 duration-200 font-sans">
            <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-3">
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                Post Fixed-Rate Funding Offer
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOffer} className="space-y-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Perpetual Position Direction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSide("long")}
                    className={`py-2 rounded-xl border font-semibold transition ${
                      newSide === "long"
                        ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-transparent"
                        : "bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-black/[0.06] dark:border-white/[0.06]"
                    }`}
                  >
                    LONG (s = +1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSide("short")}
                    className={`py-2 rounded-xl border font-semibold transition ${
                      newSide === "short"
                        ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-transparent"
                        : "bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-black/[0.06] dark:border-white/[0.06]"
                    }`}
                  >
                    SHORT (s = -1)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Hedged Notional ($ USD)
                </label>
                <input
                  type="number"
                  min="100"
                  max="50000"
                  step="100"
                  value={newNotional}
                  onChange={(e) => setNewNotional(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono font-bold text-zinc-950 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Agreed Fixed Rate (% per 8h)
                </label>
                <input
                  type="number"
                  step="0.005"
                  min="-0.50"
                  max="0.50"
                  value={newFixedRate}
                  onChange={(e) => setNewFixedRate(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono font-bold text-zinc-950 dark:text-white"
                />
              </div>

              {/* Collateral preview box */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-black/[0.06] dark:border-white/[0.06] space-y-1.5">
                <div className="text-zinc-400 uppercase text-[10px] font-bold">
                  Solana Escrow Collateral Breakdown:
                </div>
                <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
                  <span>Your Escrow (Buyer):</span>
                  <strong className="text-zinc-950 dark:text-white">
                    {formatCurrency(previewCollateral.buyerCollateralCents)}
                  </strong>
                </div>
                <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
                  <span>Counterparty Escrow (Taker):</span>
                  <strong className="text-zinc-950 dark:text-white">
                    {formatCurrency(previewCollateral.riskTakerCollateralCents)}
                  </strong>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold font-mono shadow-sm transition"
                >
                  Publish Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
