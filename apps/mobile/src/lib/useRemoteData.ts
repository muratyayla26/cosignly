import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

const TIMEOUT_MS = 15_000;

export type RemoteData<T> =
  | { kind: "loading" }
  /** `stale` is true when the last refresh failed and `data` is from an earlier load. */
  | { kind: "ready"; data: T; updatedAt: Date; stale: boolean }
  | { kind: "error" };

type Outcome<T> = { ok: true; data: T } | { ok: false };

/** Runs `load` with a timeout; never throws. */
async function attempt<T>(load: (signal: AbortSignal) => Promise<T>): Promise<Outcome<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return { ok: true, data: await load(controller.signal) };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Next state after a load: a failed refresh keeps the last good data, marked stale. */
function next<T>(prev: RemoteData<T>, outcome: Outcome<T>): RemoteData<T> {
  if (outcome.ok) return { kind: "ready", data: outcome.data, updatedAt: new Date(), stale: false };
  return prev.kind === "ready" ? { ...prev, stale: true } : { kind: "error" };
}

/**
 * Loads data from the network on mount, again on `refresh()` (pull to
 * refresh) and whenever the app returns to the foreground. Requests time out
 * after 15 s. Pass a memoized `load` (`useCallback`); a new function reloads.
 */
export function useRemoteData<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<RemoteData<T>>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    const reload = () =>
      void attempt(load).then((outcome) => {
        if (active) setState((prev) => next(prev, outcome));
      });
    reload();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") reload();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const outcome = await attempt(load);
    setState((prev) => next(prev, outcome));
    setRefreshing(false);
  }, [load]);

  /** Reloads without the pull-to-refresh spinner (e.g. when a screen regains focus). */
  const reload = useCallback(async () => {
    const outcome = await attempt(load);
    setState((prev) => next(prev, outcome));
  }, [load]);

  return { state, refreshing, refresh, reload };
}
