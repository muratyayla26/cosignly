import { StrKey } from "@stellar/stellar-sdk/base";

import type { AssetRef } from "../assets";
import type { NetworkConfig } from "../network";
import type { Thresholds, Vault, VaultSigner } from "../vault/types";
import type {
  HorizonAccount,
  HorizonBalance,
  HorizonPage,
  HorizonProblem,
  HorizonSigner,
} from "./types";

/** An account balance in Cosignly's terms. Amounts stay strings (7 decimals) to avoid float errors. */
export interface Balance {
  asset: AssetRef;
  balance: string;
  /** Trustline limit; absent for XLM. */
  limit?: string;
}

/** A Horizon account normalized for Cosignly. */
export interface AccountInfo {
  id: string;
  sequence: string;
  /** Signers, trustlines and other entries; each raises the minimum XLM balance. */
  subentryCount: number;
  thresholds: Thresholds;
  /** Weight of the account's own key (0 = turned off). */
  masterWeight: number;
  /** Ed25519 signers other than the account's own key, with weight > 0. */
  signers: VaultSigner[];
  /** Signers Cosignly cannot use (hash-x, pre-authorized transactions, signed payloads). */
  otherSigners: HorizonSigner[];
  balances: Balance[];
}

export class HorizonError extends Error {
  readonly status: number;
  readonly problem: HorizonProblem | undefined;

  constructor(status: number, problem?: HorizonProblem) {
    super(problem?.detail ?? problem?.title ?? `Horizon request failed with status ${status}`);
    this.name = "HorizonError";
    this.status = status;
    this.problem = problem;
  }
}

export interface HorizonClientOptions {
  network: NetworkConfig;
  /** Defaults to the global `fetch` (React Native, Workers, Node 18+). */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface FindBySignerOptions extends RequestOptions {
  /** Page size, 1-200. */
  limit?: number;
  /** Safety cap on pages followed. */
  maxPages?: number;
}

export interface HorizonClient {
  /** Loads an account, or returns `null` if it does not exist (not funded yet, or removed by a testnet reset). */
  getAccount(accountId: string, options?: RequestOptions): Promise<AccountInfo | null>;
  /** All accounts that list `signer` as a signer with weight > 0. */
  findAccountsBySigner(signer: string, options?: FindBySignerOptions): Promise<AccountInfo[]>;
  /** Vaults the signer key can approve for: accounts that list it, excluding the key's own account. */
  discoverVaults(signer: string, options?: FindBySignerOptions): Promise<Vault[]>;
}

const MAX_PAGE_SIZE = 200;

export function createHorizonClient({
  network,
  fetch: fetchFn,
}: HorizonClientOptions): HorizonClient {
  const doFetch = fetchFn ?? globalThis.fetch.bind(globalThis);
  const base = network.horizonUrl.replace(/\/+$/, "");

  async function getJson<T>(url: string, options?: RequestOptions): Promise<T> {
    const response = await doFetch(url, {
      headers: { Accept: "application/json" },
      ...(options?.signal ? { signal: options.signal } : {}),
    });
    if (!response.ok) {
      throw new HorizonError(response.status, await readProblem(response));
    }
    return (await response.json()) as T;
  }

  async function getAccount(accountId: string, options?: RequestOptions) {
    assertPublicKey(accountId);
    try {
      return toAccountInfo(await getJson<HorizonAccount>(`${base}/accounts/${accountId}`, options));
    } catch (e) {
      if (e instanceof HorizonError && e.status === 404) return null;
      throw e;
    }
  }

  async function findAccountsBySigner(signer: string, options: FindBySignerOptions = {}) {
    assertPublicKey(signer);
    const limit = Math.min(Math.max(options.limit ?? MAX_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const maxPages = options.maxPages ?? 5;
    const accounts: AccountInfo[] = [];

    let url: string | undefined =
      `${base}/accounts?signer=${encodeURIComponent(signer)}&limit=${limit}&order=asc`;
    for (let page = 0; url && page < maxPages; page++) {
      const body: HorizonPage<HorizonAccount> = await getJson(url, options);
      const records = body._embedded.records;
      accounts.push(...records.map(toAccountInfo));
      // Horizon always returns a `next` link, even on the last page.
      url = records.length < limit ? undefined : body._links.next?.href;
    }
    return accounts;
  }

  async function discoverVaults(signer: string, options?: FindBySignerOptions) {
    const accounts = await findAccountsBySigner(signer, options);
    return accounts.filter((a) => a.id !== signer).map(toVault);
  }

  return { getAccount, findAccountsBySigner, discoverVaults };
}

export function toAccountInfo(raw: HorizonAccount): AccountInfo {
  const master = raw.signers.find((s) => s.key === raw.id);
  const others = raw.signers.filter((s) => s.key !== raw.id);
  return {
    id: raw.id,
    sequence: raw.sequence,
    subentryCount: raw.subentry_count,
    thresholds: {
      low: raw.thresholds.low_threshold,
      medium: raw.thresholds.med_threshold,
      high: raw.thresholds.high_threshold,
    },
    masterWeight: master?.weight ?? 0,
    signers: others
      .filter((s) => s.type === "ed25519_public_key" && s.weight > 0)
      .map((s) => ({ key: s.key, weight: s.weight })),
    otherSigners: others.filter((s) => s.type !== "ed25519_public_key"),
    balances: raw.balances.flatMap(toBalance),
  };
}

export function toVault(account: AccountInfo): Vault {
  return {
    kind: "classic",
    accountId: account.id,
    signers: account.signers,
    thresholds: account.thresholds,
    masterWeight: account.masterWeight,
  };
}

function toBalance(raw: HorizonBalance): Balance[] {
  if (raw.asset_type === "native") return [{ asset: { type: "native" }, balance: raw.balance }];
  if (raw.asset_type === "liquidity_pool_shares" || !raw.asset_code || !raw.asset_issuer) return [];
  return [
    {
      asset: { type: "credit", code: raw.asset_code, issuer: raw.asset_issuer },
      balance: raw.balance,
      ...(raw.limit !== undefined ? { limit: raw.limit } : {}),
    },
  ];
}

function assertPublicKey(key: string): void {
  if (!StrKey.isValidEd25519PublicKey(key)) {
    throw new TypeError("Not a valid Stellar public key (expected G...).");
  }
}

async function readProblem(response: Response): Promise<HorizonProblem | undefined> {
  try {
    return (await response.json()) as HorizonProblem;
  } catch {
    return undefined;
  }
}
