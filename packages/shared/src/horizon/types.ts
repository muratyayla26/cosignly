/**
 * Subset of Horizon's REST responses that Cosignly reads. Field names match
 * Horizon exactly (snake_case). Verified against horizon-testnet.stellar.org on
 * 2026-11-18; see `__fixtures__/`.
 */

export interface HorizonSigner {
  key: string;
  weight: number;
  /** `ed25519_public_key`, `sha256_hash`, `preauth_tx` or `ed25519_signed_payload`. */
  type: string;
}

export interface HorizonBalance {
  balance: string;
  asset_type: "native" | "credit_alphanum4" | "credit_alphanum12" | "liquidity_pool_shares";
  asset_code?: string;
  asset_issuer?: string;
  limit?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
}

export interface HorizonAccount {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  num_sponsoring?: number;
  num_sponsored?: number;
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  signers: HorizonSigner[];
  balances: HorizonBalance[];
  last_modified_time?: string;
}

export interface HorizonPage<T> {
  _links: { next?: { href: string } };
  _embedded: { records: T[] };
}

/** Horizon's problem+json error body. */
export interface HorizonProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  extras?: Record<string, unknown>;
}
