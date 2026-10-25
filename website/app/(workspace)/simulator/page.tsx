import type { Metadata } from "next";
import { TradingView } from "../../../components/TradingWorkspace";

export const metadata: Metadata = { title: "Hedge simulator" };

export default function Page() {
  return <TradingView tab="simulator" />;
}
