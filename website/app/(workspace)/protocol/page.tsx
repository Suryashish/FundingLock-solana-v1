import type { Metadata } from "next";
import { TradingView } from "../../../components/TradingWorkspace";

export const metadata: Metadata = { title: "How it works" };

export default function Page() {
  return <TradingView tab="overview" />;
}
