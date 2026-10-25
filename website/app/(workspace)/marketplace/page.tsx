import type { Metadata } from "next";
import { TradingView } from "../../../components/TradingWorkspace";

export const metadata: Metadata = { title: "Marketplace" };

export default function Page() {
  return <TradingView tab="marketplace" />;
}
