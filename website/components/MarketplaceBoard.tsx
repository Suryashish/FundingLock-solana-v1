"use client";

import React, { useState } from "react";
import { PRESET_MARKET_OFFERS, FIXTURE_START_TIME } from "../lib/data/fixtures.ts";
import { BINANCE_SOL_CONFIG, ContractTerms, PositionSide } from "../lib/domain/types.ts";
import { calculateCollateralRequirement } from "../lib/domain/collateral.ts";
import { formatCurrency, formatRatePercent } from "../lib/domain/funding.ts";
import { useWallet } from "@solana/wallet-adapter-react";
import { Plus, Check, X } from "lucide-react";

interface MarketplaceBoardProps {
  onAcceptOfferClick?: (offer: ContractTerms) => void;
}

export const MarketplaceBoard: React.FC<MarketplaceBoardProps> = ({
  onAcceptOfferClick,
}) => {
  const { publicKey } = useWallet();
  const [offers, setOffers] = useState<ContractTerms[]>(PRESET_MARKET_OFFERS);
  const [filterSide, setFilterSide] = useState<"all" | "long" | "short">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [acceptedOfferId, setAcceptedOfferId] = useState<string | null>(null);

  // Create offer state
  const [newSide, setNewSide] = useState<PositionSide>("long");
  const [newNotional, setNewNotional] = useState<number>(10000);
  const [newFixedRate, setNewFixedRate] = useState<number>(0.02);

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
      collateralMint: "USDC",
    };
    return calculateCollateralRequirement(terms, BINANCE_SOL_CONFIG);
  }, [newSide, newNotional, newFixedRate]);

  const handleCreateOffer = (e: React.FormEvent) => {
    e.preventDefault();
    const newOffer: ContractTerms = {
      contractId: `OFFER-SOL-${Math.floor(100 + Math.random() * 900)}`,
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
      collateralMint: "USDC",
      buyerPubkey: publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : "Demo...User",
      status: "Open",
    };
    setOffers([newOffer, ...offers]);
    setShowCreateModal(false);
  };

  const handleAccept = (offer: ContractTerms) => {
    setAcceptedOfferId(offer.contractId);
    if (onAcceptOfferClick) {
      onAcceptOfferClick(offer);
    }
  };

  const filteredOffers = offers.filter((o) => {
    if (filterSide === "all") return true;
    return o.positionSide === filterSide;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header and Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Funding Rate Hedge Marketplace
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
              SOL-PERP Offer Board
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Browse compatible fixed-rate protection offers or create your own collateralized hedge agreement
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition shadow-sm self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Offer</span>
        </button>
      </div>

      {/* Filter and Overview stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          {(["all", "long", "short"] as const).map((side) => (
            <button
              key={side}
              onClick={() => setFilterSide(side)}
              className={`px-3 py-1 rounded-md capitalize transition ${
                filterSide === side
                  ? "bg-zinc-800 text-white font-semibold border border-zinc-700"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {side === "all" ? "All Offers" : `${side} Hedges`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-zinc-400 text-[11px]">
          <span>Total Offers: <strong className="text-white">{filteredOffers.length}</strong></span>
          <span>Collateral Standard: <strong className="text-zinc-200">100% Locked</strong></span>
        </div>
      </div>

      {/* Offers Table */}
      <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] uppercase text-zinc-500 border-b border-zinc-800">
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
            <tbody className="divide-y divide-zinc-900">
              {filteredOffers.map((offer) => {
                const req = calculateCollateralRequirement(offer, BINANCE_SOL_CONFIG);
                const isAccepted = acceptedOfferId === offer.contractId;

                return (
                  <tr key={offer.contractId} className="hover:bg-zinc-800/40 transition">
                    <td className="py-3 px-3 font-semibold text-zinc-200">
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
                    <td className="py-3 px-3 font-bold text-white">
                      {formatCurrency(offer.notionalCents)}
                    </td>
                    <td className="py-3 px-3 text-zinc-200">
                      {formatRatePercent(offer.fixedRatePpm)} / 8h
                    </td>
                    <td className="py-3 px-3 text-zinc-400">
                      7 Days (21 epochs)
                    </td>
                    <td className="py-3 px-3 text-zinc-300">
                      {formatCurrency(req.buyerCollateralCents)}
                    </td>
                    <td className="py-3 px-3 text-zinc-300">
                      {formatCurrency(req.riskTakerCollateralCents)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {isAccepted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-200 font-semibold px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
                          <Check className="w-3.5 h-3.5" />
                          <span>Matched</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAccept(offer)}
                          className="px-3 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-semibold border border-zinc-700 transition"
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
        </div>
      </div>

      {/* Create Offer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-semibold text-white">
                Create Fixed Funding Hedge Offer
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOffer} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Perpetual Position Side</label>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setNewSide("long")}
                    className={`py-2 rounded-lg border font-semibold ${
                      newSide === "long"
                        ? "bg-zinc-800 text-white border-zinc-600"
                        : "bg-zinc-900 text-zinc-500 border-zinc-800"
                    }`}
                  >
                    LONG (s = +1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSide("short")}
                    className={`py-2 rounded-lg border font-semibold ${
                      newSide === "short"
                        ? "bg-zinc-800 text-white border-zinc-600"
                        : "bg-zinc-900 text-zinc-500 border-zinc-800"
                    }`}
                  >
                    SHORT (s = -1)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Hedged Notional ($ USD)</label>
                <input
                  type="number"
                  min="1000"
                  max="1000000"
                  step="1000"
                  value={newNotional}
                  onChange={(e) => setNewNotional(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Target Fixed Rate (% per 8h)</label>
                <input
                  type="number"
                  step="0.005"
                  min="-0.50"
                  max="0.50"
                  value={newFixedRate}
                  onChange={(e) => setNewFixedRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-white"
                />
              </div>

              {/* Collateral preview box */}
              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs font-mono space-y-1.5">
                <div className="text-zinc-500 uppercase text-[10px]">Calculated Collateral Requirements:</div>
                <div className="flex justify-between text-zinc-300">
                  <span>Your Deposit (Buyer):</span>
                  <strong className="text-white">{formatCurrency(previewCollateral.buyerCollateralCents)}</strong>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Taker Deposit (Seller):</span>
                  <strong className="text-white">{formatCurrency(previewCollateral.riskTakerCollateralCents)}</strong>
                </div>
                <div className="flex justify-between text-zinc-400 text-[11px] pt-1 border-t border-zinc-850">
                  <span>Max Guaranteed Payout:</span>
                  <span>{formatCurrency(previewCollateral.maxBuyerPayoutCents)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition"
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
