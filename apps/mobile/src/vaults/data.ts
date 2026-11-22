import {
  getUsdc,
  isSameAsset,
  toVault,
  XLM,
  type AccountInfo,
  type Balance,
  type Vault,
  type VaultActivity,
} from "@cosignly/shared";

import { horizon, network } from "@/lib/stellar";

/** A vault as the app shows it: its on-chain account plus the vault view of it. */
export interface VaultSummary {
  vault: Vault;
  account: AccountInfo;
}

export interface VaultDetail extends VaultSummary {
  activity: VaultActivity[];
}

/** Vaults this signer key can approve for, found on the network by signer (Horizon `?signer=`). */
export async function loadVaults(signer: string, signal: AbortSignal): Promise<VaultSummary[]> {
  const accounts = await horizon.findAccountsBySigner(signer, { signal });
  return accounts
    .filter((account) => account.id !== signer)
    .map((account) => ({ vault: toVault(account), account }));
}

/** One vault with its recent history, or `null` if the account no longer exists. */
export async function loadVaultDetail(
  accountId: string,
  signal: AbortSignal,
): Promise<VaultDetail | null> {
  const [account, activity] = await Promise.all([
    horizon.getAccount(accountId, { signal }),
    horizon.getActivity(accountId, { signal, limit: 15 }),
  ]);
  if (!account) return null;
  return { vault: toVault(account), account, activity };
}

const USDC = getUsdc(network.id);

/** XLM first, then USDC, then anything else the vault holds. */
export function sortedBalances(balances: readonly Balance[]): Balance[] {
  const rank = (b: Balance) => (isSameAsset(b.asset, XLM) ? 0 : isSameAsset(b.asset, USDC) ? 1 : 2);
  return [...balances].sort((a, b) => rank(a) - rank(b));
}

export { vaultTitle } from "./names";
