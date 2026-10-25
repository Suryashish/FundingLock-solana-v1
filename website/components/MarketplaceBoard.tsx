"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import { FIXTURE_START_TIME } from "../lib/data/fixtures.ts";
import {
  BINANCE_SOL_CONFIG,
  ContractTerms,
  PositionSide,
  FundingOfferDraft,
} from "../lib/domain/types.ts";
import { calculateCollateralRequirement } from "../lib/domain/collateral.ts";
import { formatCurrency, formatRatePercent } from "../lib/domain/funding.ts";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Plus,
  RefreshCw,
  Store,
  Wallet,
} from "lucide-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  AppDialog,
  Notice,
  PageHeader,
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
  initialDraft?: FundingOfferDraft | null;
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
  initialDraft,
}) => {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();
  const { publicKey } = wallet;
  const [offers, setOffers] = useState<ContractTerms[]>(DEFAULT_SAMPLE_OFFERS);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filterSide, setFilterSide] = useState<"all" | "long" | "short">("all");
  const [showCreateModal, setShowCreateModal] = useState(Boolean(initialDraft));
  const [resumeAfterConnect, setResumeAfterConnect] = useState(false);
  const createDialogOpen =
    showCreateModal || (resumeAfterConnect && Boolean(publicKey));
  const [reviewOffer, setReviewOffer] = useState<ContractTerms | null>(null);
  const [acceptedOfferId, setAcceptedOfferId] = useState<string | null>(null);

  // Create offer state
  const [newSide] = useState<PositionSide>(
    initialDraft?.positionSide ?? "long",
  );
  const [newNotional, setNewNotional] = useState<number>(
    (initialDraft?.notionalCents ?? 10000) / 100,
  );
  const [newFixedRate, setNewFixedRate] = useState<number>(
    (initialDraft?.fixedRatePpm ?? 200) / 10000,
  );
  const newIntervalCount = initialDraft?.intervalCount ?? 21;
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
      notionalCents: Math.round(newNotional * 100),
      fixedRatePpm: Math.round(newFixedRate * 10000),
      intervalCount: newIntervalCount,
      intervalSeconds: 28800,
      startTime: FIXTURE_START_TIME,
      endTime: FIXTURE_START_TIME + newIntervalCount * 28800,
      minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
      maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
      collateralMint: "SOL",
    };
    return calculateCollateralRequirement(terms, BINANCE_SOL_CONFIG);
  }, [newSide, newNotional, newFixedRate, newIntervalCount]);

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
          notionalCents: Math.round(newNotional * 100),
          fixedRatePpm: Math.round(newFixedRate * 10000),
          intervalCount: newIntervalCount,
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
        notionalCents: Math.round(newNotional * 100),
        fixedRatePpm: Math.round(newFixedRate * 10000),
        intervalCount: newIntervalCount,
        intervalSeconds: 28800,
        startTime: FIXTURE_START_TIME,
        endTime: FIXTURE_START_TIME + newIntervalCount * 28800,
        minRatePpm: BINANCE_SOL_CONFIG.minRatePpm,
        maxRatePpm: BINANCE_SOL_CONFIG.maxRatePpm,
        collateralMint: "SOL",
        buyerPubkey: publicKey.toBase58(),
        status: "Open",
      };

      setOffers((prev) => [newOffer, ...prev]);
      setShowCreateModal(false);
      setResumeAfterConnect(false);
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

  const hasExamples = offers.some((offer) =>
    offer.contractId.startsWith("OFF-BENCH"),
  );
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
  const closeCreate = () => {
    if (actionStatus.state !== "pending") {
      setShowCreateModal(false);
      setResumeAfterConnect(false);
    }
  };
  const days = (offer: ContractTerms) => offer.intervalCount / 3;
  const offerAction = (offer: ContractTerms) => {
    if (acceptedOfferId === offer.contractId || offer.status === "Matched")
      return (
        <span className="app-badge app-badge-accent">
          <Check size={12} />
          Matched
        </span>
      );
    if (offer.status && offer.status !== "Open")
      return <span className="app-badge">{offer.status}</span>;
    if (
      publicKey &&
      onChainContracts[offer.contractId]?.buyer.equals(publicKey)
    )
      return <span className="app-badge">Your offer</span>;
    const example = offer.contractId.startsWith("OFF-BENCH");
    return (
      <button
        className="app-button app-button-secondary"
        disabled={actionStatus.state === "pending"}
        onClick={() =>
          example ? void handleAccept(offer) : setReviewOffer(offer)
        }
      >
        {example ? "Try example" : "View offer"}
        <ArrowRight size={13} />
      </button>
    );
  };

  return (
    <div className="app-page simple-page">
      <PageHeader
        title="Find an offer"
        description="Create an offer for your position, or review another trader’s offer."
        actions={
          <button
            className="app-button app-button-primary"
            onClick={() => {
              setActionStatus({ state: "idle", message: "" });
              setResumeAfterConnect(false);
              setShowCreateModal(true);
            }}
          >
            <Plus size={15} />
            Create an offer
          </button>
        }
      />
      {!createDialogOpen && !reviewOffer && actionNotice}
      <div className="market-toolbar">
        <SegmentedControl
          label="Filter offers"
          value={filterSide}
          onChange={setFilterSide}
          options={[
            { value: "all", label: "All offers" },
            { value: "long", label: "Long" },
            { value: "short", label: "Short" },
          ]}
        />
        <button
          className="simple-inline-link"
          onClick={() => void loadOnChainOffers()}
          disabled={isLoadingOffers}
        >
          <RefreshCw
            size={13}
            className={isLoadingOffers ? "app-spinning" : ""}
          />
          {isLoadingOffers ? "Updating…" : "Refresh"}
        </button>
      </div>
      <section
        className="app-panel"
        aria-label="Funding offers"
        aria-busy={isLoadingOffers}
      >
        {filteredOffers.length === 0 ? (
          <div className="app-empty">
            <Store size={25} />
            <h2>No offers for this position yet</h2>
            <p>Choose another filter or create an offer.</p>
          </div>
        ) : (
          <>
            <div className="app-table-scroll market-table">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Position size</th>
                    <th>Fixed rate / 8h</th>
                    <th>Duration</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOffers.map((offer) => (
                    <tr key={offer.contractId}>
                      <td>
                        <span
                          className={`app-badge ${offer.positionSide === "long" ? "app-badge-accent" : "app-badge-blue"}`}
                        >
                          {offer.positionSide === "long" ? "Long" : "Short"}
                        </span>
                        {offer.contractId.startsWith("OFF-BENCH") && (
                          <small>Example</small>
                        )}
                      </td>
                      <td>
                        <strong>{formatCurrency(offer.notionalCents)}</strong>
                      </td>
                      <td className="app-accent">
                        <strong>{formatRatePercent(offer.fixedRatePpm)}</strong>
                      </td>
                      <td>{days(offer)} days</td>
                      <td>{offerAction(offer)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="market-cards">
              {filteredOffers.map((offer) => (
                <article className="market-card" key={offer.contractId}>
                  <div className="app-row-between">
                    <strong>
                      {offer.positionSide === "long" ? "Long" : "Short"}{" "}
                      SOL-PERP
                    </strong>
                    {offer.contractId.startsWith("OFF-BENCH") && (
                      <span className="app-badge">Example</span>
                    )}
                  </div>
                  <dl className="app-detail-list">
                    <div>
                      <dt>Position size</dt>
                      <dd>{formatCurrency(offer.notionalCents)}</dd>
                    </div>
                    <div>
                      <dt>Fixed rate / 8h</dt>
                      <dd>{formatRatePercent(offer.fixedRatePpm)}</dd>
                    </div>
                    <div>
                      <dt>Duration</dt>
                      <dd>{days(offer)} days</dd>
                    </div>
                  </dl>
                  {offerAction(offer)}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
      <p className="simple-example-note">
        {loadFailed ? "Couldn’t refresh Testnet offers. " : ""}
        {hasExamples
          ? "Example offers open a walkthrough without a wallet."
          : "View an offer to review its terms before accepting."}
      </p>
      <details className="app-disclosure">
        <summary>
          <span>What happens when I accept an offer?</span>
          <ChevronDown size={16} />
        </summary>
        <div className="app-panel-body simple-help-copy">
          <p>
            You become the counterparty to the trader who created the offer.
            Both of you deposit collateral before the hedge starts. At the end,
            the contract pays the funding difference and returns unused
            collateral.
          </p>
          <p>
            Your result is the opposite of the offer creator’s. Review the rate,
            position size, and required deposit before you accept.
          </p>
        </div>
      </details>
      {createDialogOpen && (
        <AppDialog
          title={initialDraft ? "Review your offer" : "Create an offer"}
          description={`Long SOL-PERP · ${newIntervalCount / 3} days · Solana Testnet`}
          onClose={closeCreate}
        >
          <form onSubmit={handleCreateOffer} className="app-stack-small">
            {actionNotice}
            <div className="app-field">
              <label htmlFor="offer-notional">Position size</label>
              <div className="app-input-unit">
                <input
                  id="offer-notional"
                  className="app-input"
                  type="number"
                  min={25}
                  max={50000}
                  step={0.01}
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
                  step={0.0001}
                  value={newFixedRate}
                  onChange={(event) =>
                    setNewFixedRate(Number(event.target.value))
                  }
                  required
                />
                <span>% / 8h</span>
              </div>
            </div>
            <div className="simple-offer-summary">
              <span>Estimated deposit after matching</span>
              <strong>
                {formatCurrency(previewCollateral.buyerCollateralCents)}
              </strong>
              <small>
                Testnet deposit estimate:{" "}
                {(previewCollateral.buyerCollateralCents / 10000).toFixed(4)}{" "}
                SOL.
              </small>
            </div>
            <p className="simple-next-step">
              Publishing creates an offer. Your hedge starts only after a
              counterparty accepts and both deposits are funded.
            </p>
            <div className="app-dialog-footer">
              <button
                type="button"
                className="app-button app-button-secondary"
                onClick={closeCreate}
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
                    ? "Publishing…"
                    : "Publish offer"}
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="app-button app-button-primary"
                  onClick={() => {
                    setShowCreateModal(false);
                    setResumeAfterConnect(true);
                    setVisible(true);
                  }}
                >
                  <Wallet size={14} />
                  Connect wallet to continue
                </button>
              )}
            </div>
          </form>
        </AppDialog>
      )}
      {reviewOffer && (
        <AppDialog
          title="Review this offer"
          description="You would take the other side of this funding agreement."
          onClose={() => {
            if (actionStatus.state !== "pending") setReviewOffer(null);
          }}
        >
          <div className="app-stack-small">
            {actionNotice}
            <dl className="app-detail-list">
              <div>
                <dt>Market</dt>
                <dd>SOL-PERP</dd>
              </div>
              <div>
                <dt>Creator’s position</dt>
                <dd>
                  {reviewOffer.positionSide === "long" ? "Long" : "Short"}
                </dd>
              </div>
              <div>
                <dt>Position size</dt>
                <dd>{formatCurrency(reviewOffer.notionalCents)}</dd>
              </div>
              <div>
                <dt>Fixed rate per 8 hours</dt>
                <dd>{formatRatePercent(reviewOffer.fixedRatePpm)}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{days(reviewOffer)} days</dd>
              </div>
              <div>
                <dt>Your estimated collateral</dt>
                <dd>
                  {formatCurrency(
                    calculateCollateralRequirement(
                      reviewOffer,
                      BINANCE_SOL_CONFIG,
                    ).riskTakerCollateralCents,
                  )}
                </dd>
              </div>
            </dl>
            <p className="simple-next-step">
              Collateral is deposited separately after matching. These USD
              estimates are funded in Testnet SOL.
            </p>
            {publicKey ? (
              <button
                className="app-button app-button-primary"
                disabled={actionStatus.state === "pending"}
                onClick={() => void handleAccept(reviewOffer)}
              >
                {actionStatus.state === "pending"
                  ? "Accepting…"
                  : "Accept this offer"}
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                className="app-button app-button-primary"
                onClick={() => {
                  setReviewOffer(null);
                  setVisible(true);
                }}
              >
                <Wallet size={14} />
                Connect wallet
              </button>
            )}
          </div>
        </AppDialog>
      )}
    </div>
  );
};
