"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  ArrowUpRight,
  BookOpen,
  Calculator,
  Check,
  Copy,
  LogOut,
  Menu,
  Moon,
  Store,
  Sun,
  Wallet,
} from "lucide-react";
import { AppDialog, Brand } from "./ApplicationUI";

export type NavTab =
  "simulator" | "historical" | "marketplace" | "replay" | "overview";
interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}
const items = [
  {
    id: "simulator" as const,
    label: "Calculator",
    href: "/simulator",
    icon: Calculator,
  },
  {
    id: "marketplace" as const,
    label: "Offers",
    href: "/marketplace",
    icon: Store,
  },
  {
    id: "overview" as const,
    label: "How it works",
    href: "/protocol",
    icon: BookOpen,
  },
];

export function SideNavbar({
  activeTab,
  onSelectTab,
  isDark = false,
  onToggleTheme,
}: Props) {
  const { connected, publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  const primaryTab =
    activeTab === "historical"
      ? "simulator"
      : activeTab === "replay"
        ? "overview"
        : activeTab;
  const navigation = (
    <nav aria-label="App navigation" className="app-sidebar-nav">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={primaryTab === item.id ? "page" : undefined}
          onClick={(event) => {
            if (
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey
            ) {
              event.preventDefault();
              onSelectTab(item.id);
              setMobileOpen(false);
            }
          }}
        >
          <item.icon size={18} />
          <span>{item.label}</span>
          {primaryTab === item.id && <span className="app-nav-indicator" />}
        </Link>
      ))}
    </nav>
  );
  const theme = (
    <button
      className="simple-theme-button"
      onClick={onToggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      <span>{isDark ? "Light appearance" : "Dark appearance"}</span>
    </button>
  );
  return (
    <>
      <aside className="app-sidebar simple-sidebar">
        <Brand />
        {navigation}
        <div className="simple-sidebar-bottom">
          {theme}
          <Link href="/" className="simple-sidebar-home">
            Back to website <ArrowUpRight size={13} />
          </Link>
        </div>
      </aside>
      <div className="app-workspace-column">
        <header className="app-topbar">
          <div className="app-topbar-mobile">
            <button
              ref={trigger}
              className="app-icon-button"
              aria-label="Open app navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <Brand compact />
          </div>
          <span className="simple-workspace-title">Your funding workspace</span>
          <div className="app-topbar-actions">
            <span className="app-badge app-network-badge">
              <i />
              Testnet
            </span>
            <button
              className="app-button app-button-secondary app-wallet-connect"
              disabled={connecting}
              onClick={() =>
                connected && publicKey ? setAccountOpen(true) : setVisible(true)
              }
            >
              <Wallet size={15} />
              {connecting
                ? "Connecting…"
                : connected && publicKey
                  ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
                  : "Connect wallet"}
            </button>
          </div>
        </header>
      </div>
      {mobileOpen && (
        <AppDialog
          title="Menu"
          onClose={() => {
            setMobileOpen(false);
            trigger.current?.focus();
          }}
        >
          <div className="app-mobile-navigation">
            {navigation}
            {theme}
            <Link href="/" className="simple-sidebar-home">
              Back to website <ArrowUpRight size={13} />
            </Link>
          </div>
        </AppDialog>
      )}
      {accountOpen && publicKey && (
        <AppDialog
          title="Your wallet"
          description="Connected to Solana Testnet."
          onClose={() => setAccountOpen(false)}
        >
          <div className="app-stack-small">
            <code className="simple-wallet-address">
              {publicKey.toBase58()}
            </code>
            <button
              className="app-button app-button-secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(publicKey.toBase58());
                  setCopied(true);
                  copyTimer.current = setTimeout(() => setCopied(false), 1800);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
              {copied ? "Address copied" : "Copy address"}
            </button>
            <button
              className="app-button app-button-secondary"
              onClick={() => {
                void disconnect();
                setAccountOpen(false);
              }}
            >
              <LogOut size={15} />
              Disconnect wallet
            </button>
          </div>
        </AppDialog>
      )}
    </>
  );
}
