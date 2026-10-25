"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  ArrowUpRight,
  BookOpen,
  ChartColumnIncreasing,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FlaskConical,
  HelpCircle,
  LogOut,
  Menu,
  Moon,
  Network,
  SlidersHorizontal,
  Store,
  Sun,
  Wallet,
} from "lucide-react";
import { PROGRAM_ID } from "../lib/solana/client";
import { AppDialog, Brand } from "./ApplicationUI";

export type NavTab =
  "simulator" | "historical" | "marketplace" | "replay" | "overview";
interface SideNavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}
const navItems = [
  {
    id: "simulator" as const,
    label: "Hedge simulator",
    href: "/simulator",
    icon: SlidersHorizontal,
  },
  {
    id: "marketplace" as const,
    label: "Marketplace",
    href: "/marketplace",
    icon: Store,
  },
  {
    id: "replay" as const,
    label: "Contract flow",
    href: "/contract-flow",
    icon: Network,
  },
  {
    id: "historical" as const,
    label: "Funding history",
    href: "/rates",
    icon: ChartColumnIncreasing,
  },
  {
    id: "overview" as const,
    label: "Protocol guide",
    href: "/protocol",
    icon: BookOpen,
  },
];

export function SideNavbar({
  activeTab,
  onSelectTab,
  isDark = true,
  onToggleTheme,
}: SideNavbarProps) {
  const { connected, publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [specsOpen, setSpecsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  const select = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };
  const navigation = (
    <>
      <div className="app-sidebar-section-label">WORKSPACE</div>
      <nav aria-label="Workspace navigation" className="app-sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={activeTab === item.id ? "page" : undefined}
            onClick={(event) => {
              if (
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                select(item.id);
              }
            }}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
            {activeTab === item.id && <span className="app-nav-indicator" />}
          </Link>
        ))}
      </nav>
    </>
  );
  const walletButton = (
    <button
      className="app-button app-button-primary app-wallet-connect"
      onClick={() => setVisible(true)}
      disabled={connecting}
    >
      <Wallet size={16} />
      {connecting
        ? "Connecting…"
        : connected && publicKey
          ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
          : "Connect wallet"}
    </button>
  );
  return (
    <>
      <aside className="app-sidebar">
        <Brand />
        <div className="app-workspace-label">
          <span className="app-market-icon">S</span>
          <div>
            <strong>SOL perpetuals</strong>
            <span>Funding-rate workspace</span>
          </div>
          <ChevronRight size={14} />
        </div>
        {navigation}
        <div className="app-sidebar-bottom">
          <div className="app-help-card">
            <HelpCircle size={19} />
            <strong>A little more clarity.</strong>
            <p>Understand the terms before you make a move.</p>
            <Link href="/protocol">
              Read the guide <ArrowUpRight size={14} />
            </Link>
          </div>
          <button
            className="app-sidebar-utility"
            onClick={() => setSpecsOpen(true)}
          >
            <FlaskConical size={16} />
            Network & protocol
            <ExternalLink size={13} />
          </button>
          <div className="app-sidebar-utilities">
            <span>
              <i />
              Testnet environment
            </span>
            <button
              className="app-icon-button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="app-workspace-column">
        <header className="app-topbar">
          <div className="app-topbar-mobile">
            <button
              ref={trigger}
              className="app-icon-button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open workspace navigation"
            >
              <Menu size={21} />
            </button>
            <Brand compact />
          </div>
          <div className="app-breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {navItems.find((item) => item.id === activeTab)?.label}
            </strong>
          </div>
          <div className="app-topbar-actions">
            <span className="app-badge app-network-badge">
              <i />
              Solana Testnet
            </span>
            {walletButton}
            {connected && publicKey && (
              <>
                <button
                  className="app-icon-button app-wallet-utility"
                  aria-label="Copy wallet address"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(publicKey.toBase58());
                      setCopied(true);
                      copyTimer.current = setTimeout(
                        () => setCopied(false),
                        1800,
                      );
                    } catch {
                      setCopied(false);
                    }
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <button
                  className="app-icon-button app-wallet-utility"
                  aria-label="Disconnect wallet"
                  onClick={() => disconnect()}
                >
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </header>
      </div>
      {mobileOpen && (
        <AppDialog
          title="Your workspace"
          onClose={() => {
            setMobileOpen(false);
            trigger.current?.focus();
          }}
        >
          <div className="app-mobile-navigation">
            {navigation}
            <button className="app-sidebar-utility" onClick={onToggleTheme}>
              {isDark ? <Sun size={17} /> : <Moon size={17} />}Switch to{" "}
              {isDark ? "light" : "dark"} theme
            </button>
            <Link
              className="app-sidebar-utility"
              href="/"
              onClick={() => setMobileOpen(false)}
            >
              Back to homepage <ArrowUpRight size={16} />
            </Link>
          </div>
        </AppDialog>
      )}
      {specsOpen && (
        <AppDialog
          title="Network & protocol"
          description="The environment your workspace connects to."
          onClose={() => setSpecsOpen(false)}
        >
          <dl className="app-detail-list">
            <div>
              <dt>Network</dt>
              <dd>
                <span className="app-badge app-badge-accent">
                  Solana Testnet
                </span>
              </dd>
            </div>
            <div>
              <dt>Market</dt>
              <dd>Binance SOL-PERP</dd>
            </div>
            <div>
              <dt>Funding interval</dt>
              <dd>Every 8 hours</dd>
            </div>
            <div>
              <dt>Permitted rate bounds</dt>
              <dd>−0.50% to +0.50%</dd>
            </div>
            <div>
              <dt>Collateral buffer</dt>
              <dd>5%</dd>
            </div>
          </dl>
          <a
            className="app-button app-button-secondary app-full-width"
            href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=testnet`}
            target="_blank"
            rel="noreferrer"
          >
            View deployed contract <ArrowUpRight size={16} />
          </a>
        </AppDialog>
      )}
    </>
  );
}
