/**
 * How a vault is implemented on Stellar.
 * - `classic`: a normal account protected by built-in multisig (Sprint 1).
 * - `smart`: a smart-account contract vault (planned for Sprint 2; not implemented).
 */
export type VaultKind = "classic";

/** One signer on a vault: an Ed25519 public key (`G...`) and its weight (1-255). */
export interface VaultSigner {
  key: string;
  weight: number;
}

/**
 * Account thresholds. On Stellar every operation needs signatures whose total
 * weight reaches one of these levels:
 * - `low`: e.g. bump sequence
 * - `medium`: payments and trustlines (`payment`, `change_trust`)
 * - `high`: signer and threshold changes (`set_options`)
 */
export interface Thresholds {
  low: number;
  medium: number;
  high: number;
}

/**
 * The multisig configuration of a vault, as the setup wizard proposes it or as
 * it exists on-chain. `masterWeight` is the weight of the account's own key;
 * Cosignly vaults set it to 0 so no single key controls the account.
 */
export interface VaultConfig {
  signers: VaultSigner[];
  thresholds: Thresholds;
  masterWeight: number;
}

/** A vault as Cosignly sees it: an account plus its multisig configuration. */
export interface Vault extends VaultConfig {
  kind: VaultKind;
  /** The vault's account address (`G...`). */
  accountId: string;
}
