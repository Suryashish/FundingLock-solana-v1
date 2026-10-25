"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import { FIXTURE_START_TIME } from "../lib/data/fixtures.ts";
import {
  BINANCE_SOL_CONFIG,
  ContractTerms,
  PositionSide,
} from "../lib/domain/types.ts";
import { calculateCollateralRequirement } from "../lib/domain/collateral.ts";
import { formatCurrency, formatRatePercent } from "../lib/domain/funding.ts";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  AppDialog,
  Notice,
  PageHeader,
  Panel,
  SegmentedControl,
} from "./ApplicationUI";
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
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();
  const { publicKey } = wallet;
  const [offers, setOffers] = useState<ContractTerms[]>(DEFAULT_SAMPLE_OFFERS);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filterSide, setFilterSide] = useState<"all" | "long" | "short">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [acceptedOfferId, setAcceptedOfferId] = useState<string | null>(null);

  // Create offer state
  const [newSide, setNewSide] = useState<PositionSide>("long");
  const [newNotional, setNewNotional] = useState<number>(100);
  const [newFixedRate, setNewFixedRate] = useState<number>(0.02);
  const [onChainContracts, setOnChainContracts] = useState<
    Record<string, OnChainContractState>
  >({});
  const [actionStatus, setActionStatus] = useState<{
    state: "idle" | "pending" | "success" | "error";
    message: string;
  }>({ state: "idle", message: "" });

  const loadOnChainOffers = useCallback(async () => {
    setIsLoadingOffers(true);
    setLoadFailed(false);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const accounts = await Promise.race([
        fetchContractAccounts(connection),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("RPC timeout")), 8000);
        }),
      ]);
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
          riskTakerPubkey: account.riskTaker.equals(PublicKey.default)
            ? undefined
            : account.riskTaker.toBase58(),
          status: account.lifecycleLabel as ContractTerms["status"],
        }));
        setOffers(onChainList);
        setOnChainContracts(
          Object.fromEntries(
            accounts.map((account) => [account.contractId, account]),
          ),
        );
      }
    } catch {
      setLoadFailed(true);
    } finally {
      clearTimeout(timeout);
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
      setActionStatus({
        state: "error",
        message: "Please connect a wallet before posting an on-chain offer.",
      });
      return;
    }
    if (newSide !== "long") {
      setActionStatus({
        state: "error",
        message:
          "The deployed Testnet contract currently supports long offers.",
      });
      return;
    }

    setActionStatus({
      state: "pending",
      message: "Verifying Testnet balance and preparing transaction…",
    });
    try {
      const lamports = await connection.getBalance(publicKey, "confirmed");
      const requiredBuyerLamports =
        previewCollateral.buyerCollateralCents * 100_000;
      if (lamports < 5_000_000) {
        throw new Error(
          `Insufficient Testnet SOL (balance: ${(lamports / 1e9).toFixed(4)} SOL). Need ~0.005 SOL for fees. Ensure wallet is set to Testnet and fund at https://faucet.solana.com.`,
        );
      }
      if (lamports < requiredBuyerLamports + 5_000_000) {
        throw new Error(
          `Insufficient Testnet SOL (balance: ${(lamports / 1e9).toFixed(4)} SOL). Funding this $${newNotional.toLocaleString()} notional offer requires ${(requiredBuyerLamports / 1e9).toFixed(4)} SOL collateral. Please reduce notional to $50 or fund at https://faucet.solana.com.`,
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
          }),
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
        }),
      );

      setActionStatus({
        state: "pending",
        message:
          "Awaiting wallet approval… Please approve the transaction in your wallet prompt.",
      });

      const signature = await simulateAndSendTransaction({
        connection,
        wallet,
        description: marketConfig
          ? "Create marketplace offer"
          : "Initialize market & create marketplace offer",
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
      setActionStatus({
        state: "success",
        message: `Offer ${contractId} created on Testnet! Tx: ${formatSignature(signature)}.`,
      });
    } catch (error) {
      setActionStatus({
        state: "error",
        message:
          error instanceof Error ? error.message : "Offer creation failed.",
      });
    }
  };

  const handleAccept = async (offer: ContractTerms) => {
    const existing = offer.contractId.startsWith("OFF-BENCH")
      ? null
      : (onChainContracts[offer.contractId] ??
        (await fetchContractAccount(connection, offer.contractId).catch(
          () => null,
        )));

    // If it's a benchmark template without an active Testnet account, smoothly accept and route to Lifecycle Replay!
    if (!existing) {
      setAcceptedOfferId(offer.contractId);
      setOffers((prev) =>
        prev.map((item) =>
          item.contractId === offer.contractId
            ? { ...item, status: "Matched" }
            : item,
        ),
      );
      setActionStatus({
        state: "success",
        message: `Opening the example contract walkthrough…`,
      });
      if (onAcceptOfferClick) {
        setTimeout(() => onAcceptOfferClick(offer), 600);
      }
      return;
    }

    if (!publicKey) {
      setActionStatus({
        state: "error",
        message: "Please connect a wallet before accepting an on-chain offer.",
      });
      return;
    }
    if (existing.buyer.equals(publicKey)) {
      setActionStatus({
        state: "error",
        message:
          "The offer creator cannot accept their own offer as the risk taker.",
      });
      return;
    }

    setActionStatus({
      state: "pending",
      message: "Simulating offer acceptance on Testnet…",
    });
    try {
      const [contractPda] = getContractPda(offer.contractId);
      const signature = await simulateAndSendTransaction({
        connection,
        wallet,
        description: "Accept marketplace offer",
        instructions: [
          buildAcceptOfferIx({ contractPda, riskTaker: publicKey }),
        ],
      });
      const account = await fetchContractAccount(connection, offer.contractId);
      if (account) {
        setOnChainContracts((prev) => ({
          ...prev,
          [offer.contractId]: account,
        }));
      }
      setAcceptedOfferId(offer.contractId);
      setOffers((prev) =>
        prev.map((item) =>
          item.contractId === offer.contractId
            ? { ...item, status: "Matched" }
            : item,
        ),
      );
      setActionStatus({
        state: "success",
        message: `Offer accepted on Testnet! Tx: ${formatSignature(signature)}.`,
      });
      if (onAcceptOfferClick) {
        onAcceptOfferClick(offer);
      }
    } catch (error) {
      setActionStatus({
        state: "error",
        message:
          error instanceof Error ? error.message : "Offer acceptance failed.",
      });
    }
  };

  const filteredOffers = offers.filter((o) => {
    if (filterSide === "all") return true;
    return o.positionSide === filterSide;
  });

  const liveOfferCount = offers.filter((offer) =>
    Boolean(onChainContracts[offer.contractId]),
  ).length;
  const actionNotice = actionStatus.message && (
    <Notice
      tone={
        actionStatus.state === "error"
          ? "error"
          : actionStatus.state === "success"
            ? "success"
            : "info"
      }
      onDismiss={() => setActionStatus({ state: "idle", message: "" })}
    >
      {actionStatus.message}
    </Notice>
  );
  const offerAction = (offer: ContractTerms) => {
    const example = offer.contractId.startsWith("OFF-BENCH");
    const matched =
      acceptedOfferId === offer.contractId || offer.status === "Matched";
    if (!matched && offer.status && offer.status !== "Open") {
      return <span className="app-badge">{offer.status}</span>;
    }
    return matched ? (
      <span className="app-badge app-badge-accent">
        <Check size={12} />
        Matched
      </span>
    ) : (
      <button
        className={`app-button ${example ? "app-button-secondary" : "app-button-primary"}`}
        disabled={actionStatus.state === "pending"}
        onClick={() => handleAccept(offer)}
      >
        {example ? "Try example" : "Accept offer"}
        {example ? <ArrowUpRight size={13} /> : <ArrowRight size={13} />}
      </button>
    );
  };

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="FIND YOUR COUNTERPARTY"
        title="Marketplace"
        description="Explore fixed funding offers. Choose the terms that work for your position."
        actions={
          <button
            className="app-button app-button-primary"
            onClick={() => {
              setActionStatus({ state: "idle", message: "" });
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} />
            Create an offer
          </button>
        }
      />
      {!showCreateModal && actionNotice}
      <div className="market-toolbar">
        <SegmentedControl
          label="Filter offers"
          value={filterSide}
          onChange={setFilterSide}
          options={[
            { value: "all", label: "All offers" },
            { value: "long", label: "Long hedges" },
            { value: "short", label: "Short hedges" },
          ]}
        />
        <div className="market-summary">
          <span>
            <strong className="app-secondary">{filteredOffers.length}</strong>{" "}
            offers shown
          </span>
          <span className="app-badge">
            {liveOfferCount > 0
              ? `${liveOfferCount} Testnet contracts`
              : "Example offers"}
          </span>
          <button
            className="app-icon-button"
            aria-label="Refresh offers"
            title="Refresh offers"
            onClick={() => void loadOnChainOffers()}
            disabled={isLoadingOffers}
          >
            <RefreshCw
              size={15}
              className={isLoadingOffers ? "app-spinning" : ""}
            />
          </button>
        </div>
      </div>
      <section
        className="app-panel"
        aria-label="Funding offers"
        aria-busy={isLoadingOffers}
      >
        <div className="app-panel-heading">
          <div>
            <h2>SOL-PERP funding offers</h2>
            <p>Fixed rates per 8-hour interval · 7-day contracts</p>
          </div>
          <span className="app-badge">
            <Clock3 size={11} />
            21 intervals
          </span>
        </div>
        {filteredOffers.length === 0 ? (
          <div className="app-empty">
            <Store size={27} />
            <h3>No offers for this position</h3>
            <p>Try another filter or create an offer with your terms.</p>
          </div>
        ) : (
          <>
            <div className="app-table-scroll market-table">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Market / offer</th>
                    <th>Side</th>
                    <th>Notional</th>
                    <th>Fixed rate</th>
                    <th>Collateral</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOffers.map((offer) => {
                    const req = calculateCollateralRequirement(
                      offer,
                      BINANCE_SOL_CONFIG,
                    );
                    const example = offer.contractId.startsWith("OFF-BENCH");
                    return (
                      <tr key={offer.contractId}>
                        <td>
                          <strong>SOL-PERP</strong>
                          <small>
                            {offer.contractId} ·{" "}
                            {example ? "Example" : "Testnet"}
                          </small>
                        </td>
                        <td>
                          <span
                            className={`app-badge ${offer.positionSide === "long" ? "app-badge-accent" : "app-badge-blue"}`}
                          >
                            {offer.positionSide === "long" ? "Long" : "Short"}
                          </span>
                        </td>
                        <td>
                          <strong>{formatCurrency(offer.notionalCents)}</strong>
                          <small>USD notional</small>
                        </td>
                        <td className="app-accent">
                          <strong>
                            {formatRatePercent(offer.fixedRatePpm)}
                          </strong>
                          <small>per 8h</small>
                        </td>
                        <td>
                          {formatCurrency(req.buyerCollateralCents)}
                          <small>
                            Hedger ·{" "}
                            {formatCurrency(req.riskTakerCollateralCents)}{" "}
                            counterparty
                          </small>
                        </td>
                        <td>{offerAction(offer)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="market-cards">
              {filteredOffers.map((offer) => {
                const req = calculateCollateralRequirement(
                  offer,
                  BINANCE_SOL_CONFIG,
                );
                return (
                  <article className="market-card" key={offer.contractId}>
                    <div className="app-row-between">
                      <div>
                        <span className="market-card-id">SOL-PERP</span>
                        <p className="app-muted app-small">
                          {offer.contractId.startsWith("OFF-BENCH")
                            ? "Example offer"
                            : offer.contractId}
                        </p>
                      </div>
                      <span
                        className={`app-badge ${offer.positionSide === "long" ? "app-badge-accent" : "app-badge-blue"}`}
                      >
                        {offer.positionSide === "long"
                          ? "Long hedge"
                          : "Short hedge"}
                      </span>
                    </div>
                    <dl className="app-detail-list">
                      <div>
                        <dt>Notional size</dt>
                        <dd>{formatCurrency(offer.notionalCents)}</dd>
                      </div>
                      <div>
                        <dt>Fixed rate / 8h</dt>
                        <dd className="app-accent">
                          {formatRatePercent(offer.fixedRatePpm)}
                        </dd>
                      </div>
                      <div>
                        <dt>Duration</dt>
                        <dd>7 days · 21 intervals</dd>
                      </div>
                      <div>
                        <dt>Hedger collateral</dt>
                        <dd>{formatCurrency(req.buyerCollateralCents)}</dd>
                      </div>
                      <div>
                        <dt>Counterparty collateral</dt>
                        <dd>{formatCurrency(req.riskTakerCollateralCents)}</dd>
                      </div>
                    </dl>
                    {offerAction(offer)}
                  </article>
                );
              })}
            </div>
          </>
        )}
        <div className="app-table-caption">
          <span>
            {isLoadingOffers
              ? "Refreshing Testnet offers…"
              : loadFailed
                ? "Testnet could not be refreshed. Example offers remain available."
                : liveOfferCount
                  ? "Contract data loaded from Solana Testnet."
                  : "Example offers help you explore the contract walkthrough."}
          </span>
          <span>SOL-PERP</span>
        </div>
      </section>
      <Notice>
        <strong>Explore before you connect.</strong> Example offers open a
        simulated walkthrough. Creating or accepting a Testnet contract requires
        a connected wallet and Testnet SOL.
      </Notice>
      <Panel
        title="From an offer to a fixed rate"
        description="A clear agreement between two counterparties."
      >
        <div className="market-how-it-works">
          {[
            {
              icon: Users,
              title: "Agree on the terms",
              text: "Match a position size, fixed rate, and contract duration.",
            },
            {
              icon: LockKeyhole,
              title: "Post collateral",
              text: "Both counterparties fund the contract before activation.",
            },
            {
              icon: ShieldCheck,
              title: "Settle the difference",
              text: "The contract compares observed funding with the agreed rate.",
            },
          ].map((item) => (
            <div key={item.title}>
              <span className="app-step-icon">
                <item.icon size={15} />
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      {showCreateModal && (
        <AppDialog
          title="Create a funding offer"
          description="Set your terms for a 7-day SOL-PERP hedge on Testnet."
          onClose={() => {
            if (actionStatus.state !== "pending") setShowCreateModal(false);
          }}
        >
          <form onSubmit={handleCreateOffer} className="app-stack-small">
            {actionNotice}
            <div className="app-field">
              <span className="app-field-label">Position direction</span>
              <SegmentedControl
                label="Offer position direction"
                value={newSide}
                onChange={setNewSide}
                options={[
                  { value: "long", label: "Long hedge" },
                  { value: "short", label: "Short hedge" },
                ]}
              />
              {newSide === "short" && (
                <small>
                  Short positions can be explored in the simulator. The current
                  Testnet contract supports long offers.
                </small>
              )}
            </div>
            <div className="app-field">
              <label htmlFor="offer-notional">Notional size</label>
              <div className="app-input-unit">
                <input
                  id="offer-notional"
                  className="app-input"
                  type="number"
                  min={25}
                  max={50000}
                  step={25}
                  value={newNotional}
                  onChange={(event) =>
                    setNewNotional(Number(event.target.value))
                  }
                  required
                />
                <span>USD</span>
              </div>
            </div>
            <div className="app-field">
              <label htmlFor="offer-fixed-rate">Fixed funding rate</label>
              <div className="app-input-unit">
                <input
                  id="offer-fixed-rate"
                  className="app-input"
                  type="number"
                  min={-0.5}
                  max={0.5}
                  step={0.005}
                  value={newFixedRate}
                  onChange={(event) =>
                    setNewFixedRate(Number(event.target.value))
                  }
                  required
                />
                <span>% / 8h</span>
              </div>
            </div>
            <div className="app-notice">
              <ShieldCheck size={17} />
              <div>
                <strong>Estimated collateral</strong>
                <dl className="app-detail-list" style={{ marginTop: 12 }}>
                  <div>
                    <dt>Hedger</dt>
                    <dd>
                      {formatCurrency(previewCollateral.buyerCollateralCents)}
                    </dd>
                  </div>
                  <div>
                    <dt>Counterparty</dt>
                    <dd>
                      {formatCurrency(
                        previewCollateral.riskTakerCollateralCents,
                      )}
                    </dd>
                  </div>
                </dl>
                <span className="app-muted">
                  USD estimates. Deposits are made in Testnet SOL.
                </span>
              </div>
            </div>
            <div className="app-dialog-footer">
              <button
                type="button"
                className="app-button app-button-secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={actionStatus.state === "pending"}
              >
                Cancel
              </button>
              {publicKey ? (
                <button
                  type="submit"
                  className="app-button app-button-primary"
                  disabled={
                    actionStatus.state === "pending" || newSide !== "long"
                  }
                >
                  {actionStatus.state === "pending"
                    ? "Preparing offer…"
                    : "Publish on Testnet"}
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="app-button app-button-primary"
                  onClick={() => {
                    setShowCreateModal(false);
                    setVisible(true);
                  }}
                >
                  <Wallet size={15} />
                  Connect wallet
                </button>
              )}
            </div>
          </form>
        </AppDialog>
      )}
    </div>
  );
};
