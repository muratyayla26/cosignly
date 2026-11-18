import { StrKey } from "@stellar/stellar-sdk/base";

import type { VaultConfig, VaultSigner } from "./types";

/** Stellar allows the master key plus up to this many additional signers. */
export const MAX_ADDITIONAL_SIGNERS = 20;
/** Weights and thresholds are stored as a single byte on-chain. */
export const MAX_WEIGHT = 255;

/** Pseudo key used in issues that refer to the account's own (master) key. */
export const MASTER_KEY = "master";

export type VaultIssueCode =
  // Errors: the configuration cannot be submitted.
  | "INVALID_SIGNER_KEY"
  | "DUPLICATE_SIGNER"
  | "INVALID_SIGNER_WEIGHT"
  | "INVALID_MASTER_WEIGHT"
  | "INVALID_THRESHOLD"
  | "TOO_MANY_SIGNERS"
  | "NO_SIGNERS"
  | "THRESHOLD_ORDER"
  | "THRESHOLD_ZERO"
  | "TOTAL_WEIGHT_BELOW_HIGH"
  // Warnings: allowed, but only after the user explicitly confirms.
  | "N_MINUS_ONE"
  | "SINGLE_SIGNER_CAN_PAY"
  | "MASTER_KEY_ACTIVE";

export interface VaultIssue {
  code: VaultIssueCode;
  severity: "error" | "warning";
  /** Plain-language explanation, safe to show in the UI. */
  message: string;
  /** Signer keys the issue is about (`MASTER_KEY` for the account's own key). */
  signers?: string[];
}

export interface VaultValidation {
  /** `true` when there are no errors. */
  valid: boolean;
  /** `true` when there are warnings the user must explicitly accept. */
  requiresConfirmation: boolean;
  issues: VaultIssue[];
}

const isByte = (n: number, min: number) => Number.isInteger(n) && n >= min && n <= MAX_WEIGHT;

/**
 * Checks a vault's multisig configuration for mistakes that would lock the
 * account or weaken it. Pure function; never throws.
 *
 * Rules (CLAUDE.md §5):
 * 1. Total signer weight must reach the high threshold.
 * 2. N-1: losing any one signer must still leave weight ≥ high (warning).
 * 3. low ≤ medium ≤ high.
 * 4. The master key can only be turned off (weight 0) if other signers exist.
 * Plus on-chain limits: valid keys, no duplicates, weights/thresholds 0-255,
 * at most 20 additional signers.
 */
export function validateVaultConfig(config: VaultConfig): VaultValidation {
  const issues: VaultIssue[] = [];
  const { signers, thresholds, masterWeight } = config;
  const error = (issue: Omit<VaultIssue, "severity">) =>
    issues.push({ ...issue, severity: "error" });
  const warn = (issue: Omit<VaultIssue, "severity">) =>
    issues.push({ ...issue, severity: "warning" });

  // --- Shape and on-chain limits -------------------------------------------
  const invalidKeys = signers.filter((s) => !StrKey.isValidEd25519PublicKey(s.key));
  if (invalidKeys.length > 0) {
    error({
      code: "INVALID_SIGNER_KEY",
      message:
        "Some signer addresses are not valid Stellar public keys (they should start with G).",
      signers: invalidKeys.map((s) => s.key),
    });
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const s of signers) {
    if (seen.has(s.key)) duplicates.add(s.key);
    seen.add(s.key);
  }
  if (duplicates.size > 0) {
    error({
      code: "DUPLICATE_SIGNER",
      message: "The same signer is listed more than once.",
      signers: [...duplicates],
    });
  }

  const badWeights = signers.filter((s) => !isByte(s.weight, 1));
  if (badWeights.length > 0) {
    error({
      code: "INVALID_SIGNER_WEIGHT",
      message: `Each signer's weight must be a whole number from 1 to ${MAX_WEIGHT}.`,
      signers: badWeights.map((s) => s.key),
    });
  }

  if (!isByte(masterWeight, 0)) {
    error({
      code: "INVALID_MASTER_WEIGHT",
      message: `The account key's weight must be a whole number from 0 to ${MAX_WEIGHT}.`,
      signers: [MASTER_KEY],
    });
  }

  const { low, medium, high } = thresholds;
  if (![low, medium, high].every((t) => isByte(t, 0))) {
    error({
      code: "INVALID_THRESHOLD",
      message: `Thresholds must be whole numbers from 0 to ${MAX_WEIGHT}.`,
    });
  }

  if (signers.length > MAX_ADDITIONAL_SIGNERS) {
    error({
      code: "TOO_MANY_SIGNERS",
      message: `A vault can have at most ${MAX_ADDITIONAL_SIGNERS} signers.`,
    });
  }

  // Weight checks below only make sense once the numbers themselves are valid.
  if (issues.length > 0) return result(issues);

  // --- Rule 4: never turn off the account key without other signers --------
  if (masterWeight === 0 && signers.length === 0) {
    error({
      code: "NO_SIGNERS",
      message: "Add at least one signer before turning off the account's own key.",
    });
    return result(issues);
  }

  // --- Rule 3: low ≤ medium ≤ high -----------------------------------------
  if (!(low <= medium && medium <= high)) {
    error({
      code: "THRESHOLD_ORDER",
      message:
        "Changing signers must need at least as many approvals as payments, and payments at least as many as minor actions.",
    });
  }

  if (medium < 1 || high < 1) {
    error({
      code: "THRESHOLD_ZERO",
      message: "Payments and signer changes must need at least one approval.",
    });
  }

  // --- Rule 1: the signers together must be able to reach `high` -----------
  const active = activeSigners(config);
  const total = sumWeights(active);
  if (total < high) {
    error({
      code: "TOTAL_WEIGHT_BELOW_HIGH",
      message: `All signers together have weight ${total}, but changing signers needs ${high}. The vault could never be changed and might lock.`,
    });
  }

  if (issues.length > 0) return result(issues);

  // --- Rule 2 (N-1): losing any single signer must not lock the vault ------
  const critical = active.filter((s) => total - s.weight < high);
  if (critical.length > 0) {
    const blocksPayments = active.some((s) => total - s.weight < medium);
    warn({
      code: "N_MINUS_ONE",
      message: blocksPayments
        ? "If one signer loses their key, the others can no longer send payments or change signers. Funds in the vault could be locked for good."
        : "If one signer loses their key, the others can still send payments but can no longer change signers or replace the lost key.",
      signers: critical.map((s) => s.key),
    });
  }

  // --- A single key should not be able to move funds alone ------------------
  const soloPayers = active.filter((s) => s.weight >= medium);
  if (soloPayers.length > 0) {
    warn({
      code: "SINGLE_SIGNER_CAN_PAY",
      message: "A single signer can send payments without anyone else's approval.",
      signers: soloPayers.map((s) => s.key),
    });
  }

  if (masterWeight > 0) {
    warn({
      code: "MASTER_KEY_ACTIVE",
      message: "The vault's own account key can still sign. Cosignly vaults normally turn it off.",
      signers: [MASTER_KEY],
    });
  }

  return result(issues);
}

/** Signers that count towards thresholds, including the master key when its weight is above 0. */
export function activeSigners(config: VaultConfig): VaultSigner[] {
  const signers = config.signers.filter((s) => s.weight > 0);
  return config.masterWeight > 0
    ? [...signers, { key: MASTER_KEY, weight: config.masterWeight }]
    : signers;
}

export function sumWeights(signers: readonly VaultSigner[]): number {
  return signers.reduce((sum, s) => sum + s.weight, 0);
}

function result(issues: VaultIssue[]): VaultValidation {
  return {
    valid: !issues.some((i) => i.severity === "error"),
    requiresConfirmation: issues.some((i) => i.severity === "warning"),
    issues,
  };
}
