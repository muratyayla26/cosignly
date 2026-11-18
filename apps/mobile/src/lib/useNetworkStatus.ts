import type { NetworkStatus } from "@cosignly/shared";
import { useCallback, useEffect, useState } from "react";

import { horizon } from "./stellar";

export type NetworkState =
  | { kind: "loading" }
  | { kind: "online"; status: NetworkStatus }
  | { kind: "wrong-network"; status: NetworkStatus }
  | { kind: "offline" };

const TIMEOUT_MS = 10_000;

/** Asks Horizon for its status; never throws. */
export async function fetchNetworkState(): Promise<NetworkState> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const status = await horizon.getNetworkStatus({ signal: controller.signal });
    return { kind: status.ok ? "online" : "wrong-network", status };
  } catch {
    return { kind: "offline" };
  } finally {
    clearTimeout(timer);
  }
}

/** Checks Horizon once on mount; `refresh()` checks again. */
export function useNetworkStatus() {
  const [state, setState] = useState<NetworkState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchNetworkState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setState(await fetchNetworkState());
    setRefreshing(false);
  }, []);

  return { state, refreshing, refresh };
}
