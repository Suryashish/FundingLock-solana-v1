import { useState, useEffect, useCallback } from "react";
import { Connection } from "@solana/web3.js";
import { fetchCounterState, CounterState } from "@/lib/contract";

export function useContractState(connection: Connection) {
  const [state, setState] = useState<CounterState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCounterState(connection);
      setState(data);
    } catch (err) {
      console.error("Failed to fetch counter state:", err);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { state, loading, refresh };
}

