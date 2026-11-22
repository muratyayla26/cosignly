import { truncateAddress } from "@cosignly/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Vault names the user gave in the setup wizard. Kept on this phone only: a
 * vault on Stellar has no name, and other signers name it on their own phones.
 * Not secret, so AsyncStorage (docs/design.md §1).
 */
export const VAULT_NAMES_STORAGE_KEY = "cosignly.vaultNames";

export type VaultNames = Readonly<Record<string, string>>;

export async function loadVaultNames(): Promise<VaultNames> {
  try {
    const raw = await AsyncStorage.getItem(VAULT_NAMES_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string"),
    );
  } catch {
    return {};
  }
}

async function saveVaultNames(names: VaultNames): Promise<void> {
  try {
    await AsyncStorage.setItem(VAULT_NAMES_STORAGE_KEY, JSON.stringify(names));
  } catch {
    // Not critical: the vault still shows with its address.
  }
}

/** "Team Vault", or "Vault GDDT…NLOL" when this phone has no name for it. */
export function vaultTitle(accountId: string, names: VaultNames = {}): string {
  return names[accountId] ?? `Vault ${truncateAddress(accountId)}`;
}

interface VaultNamesContextValue {
  names: VaultNames;
  setVaultName: (accountId: string, name: string) => Promise<void>;
}

const VaultNamesContext = createContext<VaultNamesContextValue>({
  names: {},
  setVaultName: async () => undefined,
});

export function VaultNamesProvider({ children }: { children: ReactNode }) {
  const [names, setNames] = useState<VaultNames>({});

  useEffect(() => {
    let active = true;
    void loadVaultNames().then((loaded) => {
      // Keep names set before loading finished (e.g. a vault created right away).
      if (active) setNames((current) => ({ ...loaded, ...current }));
    });
    return () => {
      active = false;
    };
  }, []);

  const setVaultName = useCallback(async (accountId: string, name: string) => {
    const next = { ...(await loadVaultNames()), [accountId]: name };
    setNames((current) => ({ ...current, [accountId]: name }));
    await saveVaultNames(next);
  }, []);

  return <VaultNamesContext value={{ names, setVaultName }}>{children}</VaultNamesContext>;
}

export function useVaultNames(): VaultNamesContextValue {
  return useContext(VaultNamesContext);
}
