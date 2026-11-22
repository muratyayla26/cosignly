import { StrKey } from "@stellar/stellar-sdk/base";

import { fromStroops } from "../amount";
import { BASE_RESERVE_STROOPS } from "./reserve";
import { MAX_ADDITIONAL_SIGNERS, type VaultIssueCode, type VaultValidation } from "./rules";
import type { Thresholds, VaultConfig, VaultSigner } from "./types";

/**
 * Helpers for the vault setup wizard (W2.1). Pure functions; the UI only
 * renders what these return, so every rule is unit-tested here.
 */

// --- Signer addresses ---------------------------------------------------------

export type SignerAddressError = "empty" | "secret-key" | "invalid";

export type SignerAddressParseResult =
  { ok: true; address: string } | { ok: false; error: SignerAddressError };

/**
 * Parses a signer address typed, pasted or scanned from a QR code.
 * Accepts a plain `G...` key and the SEP-7 / wallet URI forms some wallets
 * put in QR codes (`stellar:G...`, `web+stellar:pay?destination=G...`).
 * Never echoes the input in errors, and rejects secret keys (`S...`) so they
 * are never shown or stored as an address.
 */
export function parseSignerAddress(input: string): SignerAddressParseResult {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: "empty" };

  const candidate = extractAddress(trimmed);
  if (StrKey.isValidEd25519SecretSeed(candidate)) return { ok: false, error: "secret-key" };
  if (!StrKey.isValidEd25519PublicKey(candidate)) return { ok: false, error: "invalid" };
  return { ok: true, address: candidate };
}

function extractAddress(input: string): string {
  const destination = /[?&]destination=([A-Za-z0-9]+)/.exec(input);
  if (destination?.[1]) return destination[1].toUpperCase();
  const withoutScheme = input.replace(/^(web\+)?stellar:/i, "");
  return withoutScheme.replace(/\s+/g, "").toUpperCase();
}

export function signerAddressErrorMessage(error: SignerAddressError): string {
  switch (error) {
    case "empty":
      return "Enter a Stellar address.";
    case "secret-key":
      return "This is a secret key. Ask the signer for their public address instead (it starts with G). Never share a secret key.";
    case "invalid":
      return "This is not a valid Stellar address. It starts with G and has 56 characters.";
  }
}

// --- Templates ----------------------------------------------------------------

export interface VaultTemplate {
  id: "2-of-2" | "2-of-3" | "3-of-5";
  /** Approvals needed for payments and for signer changes. */
  required: number;
  /** Signers the template is made for. */
  signers: number;
  label: string;
}

export const VAULT_TEMPLATES: readonly VaultTemplate[] = [
  { id: "2-of-2", required: 2, signers: 2, label: "2 of 2" },
  { id: "2-of-3", required: 2, signers: 3, label: "2 of 3" },
  { id: "3-of-5", required: 3, signers: 5, label: "3 of 5" },
];

/**
 * Thresholds from the approvals needed for payments (medium) and signer
 * changes (high). `low` is set equal to `medium`: low-threshold operations
 * such as `bump_sequence` could otherwise let one signer invalidate a pending
 * proposal on their own.
 */
export function thresholdsFor(payments: number, admin: number): Thresholds {
  return { low: payments, medium: payments, high: admin };
}

/** Config for N-of-M with every signer at weight 1. */
export function equalWeightConfig(
  signerKeys: readonly string[],
  payments: number,
  admin: number,
): VaultConfig {
  return {
    signers: signerKeys.map((key) => ({ key, weight: 1 })),
    thresholds: thresholdsFor(payments, admin),
    masterWeight: 0,
  };
}

/** Config for a template, or `null` if the signer count doesn't match it. */
export function templateConfig(
  template: VaultTemplate,
  signerKeys: readonly string[],
): VaultConfig | null {
  if (signerKeys.length !== template.signers) return null;
  return equalWeightConfig(signerKeys, template.required, template.required);
}

/** The template that fits this many signers, if any (used to preselect one). */
export function defaultTemplateFor(signerCount: number): VaultTemplate | undefined {
  return VAULT_TEMPLATES.find((t) => t.signers === signerCount);
}

/** Custom (advanced) config: per-signer weights and separate thresholds. */
export function weightedConfig(
  signers: readonly VaultSigner[],
  payments: number,
  admin: number,
): VaultConfig {
  return {
    signers: signers.map((s) => ({ ...s })),
    thresholds: thresholdsFor(payments, admin),
    masterWeight: 0,
  };
}

// --- Reserve cost -------------------------------------------------------------

export interface SetupReserve {
  /** Always kept by the network for any account (2 × base reserve). */
  base: string;
  /** 0.5 XLM per signer. */
  signers: string;
  /** 0.5 XLM per trustline (USDC). */
  trustlines: string;
  /** Minimum balance the vault must keep: base + signers + trustlines. */
  total: string;
  signerCount: number;
  trustlineCount: number;
  /** Reserve per entry, e.g. "0.5". */
  perEntry: string;
}

/**
 * XLM the new vault must always keep because of its signers and trustlines.
 * Each signer and trustline is a "subentry" that adds one base reserve.
 */
export function setupReserve(signerCount: number, trustlineCount = 1): SetupReserve {
  const n = (x: number) => BigInt(x) * BASE_RESERVE_STROOPS;
  return {
    base: fromStroops(n(2)),
    signers: fromStroops(n(signerCount)),
    trustlines: fromStroops(n(trustlineCount)),
    total: fromStroops(n(2 + signerCount + trustlineCount)),
    signerCount,
    trustlineCount,
    perEntry: fromStroops(BASE_RESERVE_STROOPS),
  };
}

// --- Review gate --------------------------------------------------------------

export interface ReviewGate {
  canSubmit: boolean;
  /** Warnings the user still has to confirm. */
  unconfirmed: VaultIssueCode[];
}

/**
 * Whether the review screen may submit. Errors always block (no bypass);
 * every warning needs its own explicit confirmation.
 */
export function reviewGate(
  validation: VaultValidation,
  confirmed: ReadonlySet<VaultIssueCode>,
): ReviewGate {
  const unconfirmed = validation.issues
    .filter((i) => i.severity === "warning" && !confirmed.has(i.code))
    .map((i) => i.code);
  return { canSubmit: validation.valid && unconfirmed.length === 0, unconfirmed };
}

/** Signer list limit for the wizard (the vault's own key is turned off, so it doesn't count). */
export const MAX_VAULT_SIGNERS = MAX_ADDITIONAL_SIGNERS;
