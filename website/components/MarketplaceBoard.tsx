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
    <div className="dashboard-page space-y-8 pb-16">
      {/* Header and Create Button */}
      <div className="dashboard-toolbar">
        <div>
          <span className="dashboard-eyebrow">Fixed-rate liquidity · SOL-PERP</span>
          <h1>Hedge marketplace</h1>
          <p>
            Browse compatible fixed-rate protection offers or create your own collateralized hedge agreement
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
          <span>Total offers: <strong className="text-white">{filteredOffers.length}</strong></span>
          <span>Collateral standard: <strong className="text-zinc-200">100% locked</strong></span>
        </div>
      </div>

      {/* Offers Table */}
      <div className="dashboard-table-wrap p-2 sm:p-4 space-y-4">
        <div className="overflow-x-auto">
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
