import type { Metadata } from "next";
import { TradingView } from "../../../components/TradingWorkspace";

export const metadata: Metadata = { title: "Offers" };

export default function Page() {
  return <TradingView tab="marketplace" />;
}
