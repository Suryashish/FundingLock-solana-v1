"use client";

import React, { useCallback, useEffect, useState } from "react";
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

export const MarketplaceBoard: React.FC<MarketplaceBoardProps> = ({
  onAcceptOfferClick,
}) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { publicKey } = wallet;
  const [offers, setOffers] = useState<ContractTerms[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(true);
  const [filterSide, setFilterSide] = useState<"all" | "long" | "short">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [acceptedOfferId, setAcceptedOfferId] = useState<string | null>(null);

  // Create offer state
  const [newSide, setNewSide] = useState<PositionSide>("long");
  const [newNotional, setNewNotional] = useState<number>(10000);
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
      setOffers(accounts.map((account) => ({
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
      })));
      setOnChainContracts(Object.fromEntries(accounts.map((account) => [account.contractId, account])));
    } catch (error) {
      setActionStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Could not read Testnet offers.",
      });
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

  // Live preview of required collateral
  const previewCollateral = React.useMemo(() => {
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
      setActionStatus({ state: "error", message: "Connect a wallet before posting an on-chain offer." });
      return;
    }
    if (newSide !== "long") {
      setActionStatus({ state: "error", message: "The deployed Testnet contract currently supports long offers only." });
      return;
    }

    setActionStatus({ state: "pending", message: "Verifying Testnet balance and preparing transaction…" });
    try {
      const lamports = await connection.getBalance(publicKey, "confirmed");
      if (lamports < 5_000_000) {
        throw new Error(
          `Insufficient Testnet SOL (balance: ${(lamports / 1e9).toFixed(4)} SOL). You need ~0.005 SOL for transaction fees & account rent. Ensure your wallet is set to Testnet, and fund it at https://faucet.solana.com.`
        );
      }

      let marketConfig = await fetchMarketConfig(connection);
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
        setOnChainContracts((previous) => ({ ...previous, [contractId]: account }));
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
      setOffers((previous) => [newOffer, ...previous]);
      setShowCreateModal(false);
      setActionStatus({ state: "success", message: `Offer ${contractId} created. Transaction ${formatSignature(signature)}.` });
    } catch (error) {
      setActionStatus({ state: "error", message: error instanceof Error ? error.message : "Offer creation failed." });
    }
  };

  const handleAccept = async (offer: ContractTerms) => {
    if (!publicKey) {
      setActionStatus({ state: "error", message: "Connect a wallet before accepting an on-chain offer." });
      return;
    }
    setActionStatus({ state: "pending", message: "Simulating offer acceptance…" });
    try {
      const existing = onChainContracts[offer.contractId] ?? (await fetchContractAccount(connection, offer.contractId));
      if (!existing) {
        throw new Error("This row is a fixture offer without a matching on-chain account. Create a new on-chain offer first.");
      }
      if (existing.buyer.equals(publicKey)) {
        throw new Error("The offer creator cannot accept their own offer as the risk taker.");
      }

      const [contractPda] = getContractPda(offer.contractId);
      const signature = await simulateAndSendTransaction({
        connection,
        wallet,
        description: "Accept marketplace offer",
        instructions: [buildAcceptOfferIx({ contractPda, riskTaker: publicKey })],
      });
      const account = await fetchContractAccount(connection, offer.contractId);
      if (account) {
        setOnChainContracts((previous) => ({ ...previous, [offer.contractId]: account }));
      }
      setAcceptedOfferId(offer.contractId);
      setOffers((previous) => previous.map((item) => item.contractId === offer.contractId ? { ...item, status: "Matched" } : item));
      setActionStatus({ state: "success", message: `Offer accepted. Transaction ${formatSignature(signature)}.` });
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
    <div className="dashboard-page space-y-8 pb-16">
      {/* Header and Create Button */}
      <div className="dashboard-toolbar">
        <div>
          <span className="dashboard-eyebrow">Live Testnet liquidity · SOL-PERP</span>
          <h1>Hedge marketplace</h1>
          <p>
            Offers below are read from ContractAccount PDAs on Solana Testnet. Create and accept actions require wallet approval.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="dashboard-control flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Offer</span>
        </button>
      </div>

      {actionStatus.message && (
        <div className={`rounded-2xl border px-4 py-3 text-xs font-mono ${actionStatus.state === "error" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : actionStatus.state === "success" ? "border-[#7af6a7]/30 bg-[#7af6a7]/10 text-[#b7ffcb]" : "border-white/10 bg-white/[0.06] text-zinc-300"}`}>
          {actionStatus.message}
        </div>
      )}

      {/* Filter and Overview stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="dashboard-segmented">
          {(["all", "long", "short"] as const).map((side) => (
            <button
              key={side}
              onClick={() => setFilterSide(side)}
              data-active={filterSide === side}
              className="capitalize"
            >
              {side === "all" ? "All Offers" : `${side} Hedges`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-zinc-400 text-[11px]">
          <span>Total on-chain offers: <strong className="text-white">{filteredOffers.length}</strong></span>
          <span>Collateral standard: <strong className="text-zinc-200">100% locked</strong></span>
        </div>
      </div>

      {/* Offers Table */}
      <div className="dashboard-table-wrap p-2 sm:p-4 space-y-4">
        <div className="overflow-x-auto">
          {isLoadingOffers ? (
            <div className="p-8 text-center text-xs font-mono text-zinc-500">Reading ContractAccount PDAs from Testnet…</div>
          ) : filteredOffers.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="text-sm font-semibold text-zinc-950">No on-chain offers found</div>
              <p className="text-xs text-zinc-500">Create an offer to write the first ContractAccount PDA for this market.</p>
            </div>
          ) : (
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] uppercase text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="py-2.5 px-3">Offer ID</th>
                <th className="py-2.5 px-3">Position Side</th>
                <th className="py-2.5 px-3">Notional</th>
                <th className="py-2.5 px-3">Fixed Rate</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Buyer Collateral</th>
                <th className="py-2.5 px-3">Taker Collateral</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredOffers.map((offer) => {
                const req = calculateCollateralRequirement(offer, BINANCE_SOL_CONFIG);
                const isAccepted = acceptedOfferId === offer.contractId;

                return (
                    <tr key={offer.contractId}>
                    <td className="py-3 px-3 font-semibold text-zinc-900">
                      {offer.contractId}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                          offer.positionSide === "long"
                            ? "bg-zinc-800 text-white border border-zinc-700"
                            : "bg-zinc-900 text-zinc-400"
                        }`}
                      >
                        {offer.positionSide.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-zinc-950">
                      {formatCurrency(offer.notionalCents)}
                    </td>
                    <td className="py-3 px-3 text-zinc-900">
                      {formatRatePercent(offer.fixedRatePpm)} / 8h
                    </td>
                    <td className="py-3 px-3 text-zinc-400">
                      7 Days (21 epochs)
                    </td>
                    <td className="py-3 px-3 text-zinc-600">
                      {formatCurrency(req.buyerCollateralCents)}
                    </td>
                    <td className="py-3 px-3 text-zinc-600">
                      {formatCurrency(req.riskTakerCollateralCents)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {isAccepted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-950 font-semibold px-2.5 py-1 rounded-full bg-[#7af6a7]">
                          <Check className="w-3.5 h-3.5" />
                          <span>Matched</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAccept(offer)}
                          className="px-3 py-1.5 rounded-full bg-zinc-950 hover:bg-zinc-800 text-white text-[11px] font-semibold transition"
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

      {/* Create Offer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-black/[0.1] rounded-[28px] max-w-lg w-full p-6 space-y-5 shadow-2xl text-zinc-950">
            <div className="flex items-center justify-between border-b border-black/[0.08] pb-3">
              <h3 className="text-base font-semibold text-zinc-950">
                Create Fixed Funding Hedge Offer
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                 className="text-zinc-400 hover:text-zinc-950"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOffer} className="space-y-4">
              <div className="space-y-1.5">
                 <label className="text-xs font-medium text-zinc-700">Perpetual Position Side</label>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setNewSide("long")}
                    className={`py-2 rounded-lg border font-semibold ${
                      newSide === "long"
                         ? "bg-zinc-950 text-white border-zinc-950"
                         : "bg-zinc-50 text-zinc-500 border-black/[0.08]"
                    }`}
                  >
                    LONG (s = +1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSide("short")}
                    className={`py-2 rounded-lg border font-semibold ${
                      newSide === "short"
                         ? "bg-zinc-950 text-white border-zinc-950"
                         : "bg-zinc-50 text-zinc-500 border-black/[0.08]"
                    }`}
                  >
                    SHORT (s = -1)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                 <label className="text-xs font-medium text-zinc-700">Hedged Notional ($ USD)</label>
                <input
                  type="number"
                  min="1000"
                  max="1000000"
                  step="1000"
                  value={newNotional}
                  onChange={(e) => setNewNotional(Number(e.target.value))}
                   className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-black/[0.08] text-xs font-mono text-zinc-950"
                />
              </div>

              <div className="space-y-1.5">
                 <label className="text-xs font-medium text-zinc-700">Target Fixed Rate (% per 8h)</label>
                <input
                  type="number"
                  step="0.005"
                  min="-0.50"
                  max="0.50"
                  value={newFixedRate}
                  onChange={(e) => setNewFixedRate(Number(e.target.value))}
                   className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-black/[0.08] text-xs font-mono text-zinc-950"
                />
              </div>

              {/* Collateral preview box */}
               <div className="p-3.5 rounded-2xl bg-zinc-50 border border-black/[0.06] text-xs font-mono space-y-1.5">
                 <div className="text-zinc-500 uppercase text-[10px]">Calculated Collateral Requirements:</div>
                 <div className="flex justify-between text-zinc-700">
                  <span>Your Deposit (Buyer):</span>
                   <strong className="text-zinc-950">{formatCurrency(previewCollateral.buyerCollateralCents)}</strong>
                </div>
                 <div className="flex justify-between text-zinc-700">
                  <span>Taker Deposit (Seller):</span>
                   <strong className="text-zinc-950">{formatCurrency(previewCollateral.riskTakerCollateralCents)}</strong>
                </div>
                 <div className="flex justify-between text-zinc-500 text-[11px] pt-1 border-t border-black/[0.08]">
                  <span>Max Guaranteed Payout:</span>
                  <span>{formatCurrency(previewCollateral.maxBuyerPayoutCents)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                   className="px-4 py-2 rounded-full text-xs font-medium text-zinc-500 hover:text-zinc-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                   className="px-4 py-2 rounded-full bg-[#7af6a7] hover:bg-[#99f9ba] text-zinc-950 text-xs font-semibold transition"
                >
                  Post Offer to Board
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
