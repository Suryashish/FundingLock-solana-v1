"use client";

import React, { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { COUNTER_PDA } from "@/lib/contract";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useContractState } from "@/hooks/useContractState";
import { useContractActions } from "@/hooks/useContractActions";

import { ContractHero } from "./dashboard/ContractHero";
import { WalletStatusBanner } from "./dashboard/WalletStatusBanner";
import { TransactionAlert } from "./dashboard/TransactionAlert";
import { StateCard } from "./dashboard/StateCard";
import { MetadataCard } from "./dashboard/MetadataCard";
import { AuthorityCard } from "./dashboard/AuthorityCard";
import { ActionCards } from "./dashboard/ActionCards";
import { RoadmapNotice } from "./dashboard/RoadmapNotice";

export const ContractDashboard = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, connected } = wallet;

  // Custom modular hooks
  const balance = useWalletBalance(connection, publicKey);
  const { state, loading, refresh } = useContractState(connection);
  const actions = useContractActions(connection, wallet, refresh);

  const pdaAddress = useMemo(() => COUNTER_PDA.toBase58(), []);

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <ContractHero loading={loading} onRefresh={refresh} />

      {/* Transaction Notifications */}
      <TransactionAlert
        successMessage={actions.successMessage}
        errorMessage={actions.errorMessage}
        txSignature={actions.txSignature}
      />

      {/* Connected Wallet & Balance Badge */}
      <WalletStatusBanner publicKey={publicKey} balance={balance} />

      {/* State & Metadata Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StateCard contractState={state} loading={loading} />
        <MetadataCard counterPda={pdaAddress} contractState={state} />
        <AuthorityCard
          connected={connected}
          publicKey={publicKey}
          contractState={state}
        />
      </div>

      {/* Interactive Instruction Cards */}
      <ActionCards
        connected={connected}
        publicKey={publicKey}
        contractState={state}
        actionLoading={actions.actionLoading}
        onInitialize={actions.handleInitialize}
        onIncrement={actions.handleIncrement}
      />

      {/* Protocol Roadmap Footer Notice */}
      <RoadmapNotice />
    </div>
  );
};
