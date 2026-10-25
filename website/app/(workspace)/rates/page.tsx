import type { Metadata } from "next";
import { TradingView } from "../../../components/TradingWorkspace";

export const metadata: Metadata = { title: "Historical rates" };

export default function Page() {
  return <TradingView tab="historical" />;
}
