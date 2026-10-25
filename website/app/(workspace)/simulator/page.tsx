import type { Metadata } from "next";
import { TradingView } from "../../../components/TradingWorkspace";

export const metadata: Metadata = { title: "Funding calculator" };

export default function Page() {
  return <TradingView tab="simulator" />;
}
