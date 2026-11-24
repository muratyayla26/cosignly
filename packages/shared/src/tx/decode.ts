import {
  Asset,
  FeeBumpTransaction,
  TransactionBuilder,
  type OperationRecord,
  type Transaction,
} from "@stellar/stellar-sdk/base";

import { fromStroops } from "../amount";
import { isSameAsset, type AssetRef } from "../assets";
import { formatAmount, truncateAddress } from "../format";
import type { NetworkConfig } from "../network";
import type { VaultSigner } from "../vault/types";

/**
 * Turns a transaction envelope (base64 XDR) into plain language for the
 * review screen, so signers never approve raw XDR (W2.3).
 *
 * Cosignly understands four operation types: payment, create_account,
 * change_trust and set_options. Anything else is still listed, flagged
 * `unknown`, so the UI can show it in red. Never throws.
 */

export interface DecodeContext {
  network: NetworkConfig;
  /** The USDC Cosignly trusts; a "USDC" from any other issuer is flagged. */
  usdc: AssetRef;
  /** Names for known addresses: the vault's name, "You", contact names. */
  labels?: Readonly<Record<string, string>>;
  /** The source account's current signers, to tell "add" from "change weight". */
  currentSigners?: readonly VaultSigner[];
}

/**
 * Why an operation needs attention. The UI shows every flag in red.
 * - `unknown`: an operation type Cosignly doesn't read.
 * - `unverified-asset`: an asset that isn't XLM or Cosignly's USDC.
 * - `other-account`: the operation acts on a different account than the transaction's.
 * - `risky`: account settings that can weaken or lock the vault.
 */
export type OperationFlag = "unknown" | "unverified-asset" | "other-account" | "risky";

export interface DecodedAsset {
  /** "XLM", "USDC", or the asset's code. */
  code: string;
  /** `G...` issuer; absent for XLM. */
  issuer?: string;
  /** XLM or the configured USDC. */
  known: boolean;
}

interface OperationBase {
  /** SDK operation type, e.g. "payment", "manageData". */
  type: string;
  /** Plain-language sentence, e.g. "Send 500 USDC to Alex". */
  text: string;
  /** Extra lines (set_options can change several things at once). */
  lines: string[];
  flags: OperationFlag[];
  /** Set only when the operation acts on another account than the transaction source. */
  source?: string;
}

export type DecodedOperation =
  | (OperationBase & {
      kind: "payment";
      destination: string;
      amount: string;
      asset: DecodedAsset;
    })
  | (OperationBase & { kind: "create_account"; destination: string; startingBalance: string })
  | (OperationBase & { kind: "change_trust"; asset: DecodedAsset; limit: string; removes: boolean })
  | (OperationBase & { kind: "set_options" })
  | (OperationBase & { kind: "unknown" });

export interface DecodedMemo {
  type: "text" | "id" | "hash" | "return";
  /** Text, ID number, or hex for hash memos. */
  value: string;
}

export interface DecodedTransaction {
  /** Transaction hash (hex) on the context's network. */
  hash: string;
  source: string;
  sequence: string;
  /** Maximum fee in XLM (7-decimal string); the network may charge less. */
  maxFee: string;
  memo?: DecodedMemo;
  /** Earliest time the transaction is valid (absent = no lower bound). */
  validFrom?: Date;
  /** Expiry (absent = never expires). */
  validUntil?: Date;
  operations: DecodedOperation[];
  /** One-line title for lists and notifications, e.g. "Send 500 USDC to Alex". */
  title: string;
  /** Plain-language warnings, one per problem; empty when everything was understood. */
  warnings: string[];
}

export type DecodeError =
  /** Not a valid transaction envelope for this network. */
  | "invalid"
  /** Fee-bump envelopes aren't supported (Refractor rejects them too). */
  | "fee-bump";

export type DecodeResult = { ok: true; tx: DecodedTransaction } | { ok: false; error: DecodeError };

export function decodeTransaction(xdr: string, context: DecodeContext): DecodeResult {
  let parsed: Transaction | FeeBumpTransaction;
  try {
    parsed = TransactionBuilder.fromXDR(xdr, context.network.passphrase);
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (parsed instanceof FeeBumpTransaction) return { ok: false, error: "fee-bump" };

  const tx = parsed;
  const name = (address: string) => context.labels?.[address] ?? truncateAddress(address);
  const operations = tx.operations.map((op) => decodeOperation(op, tx.source, context, name));
  const warnings = operations.flatMap((op) => op.flags.map((f) => warningFor(f, op, name)));
  const memo = decodeMemo(tx);
  const bounds = tx.timeBounds;
  const validFrom = toDate(bounds?.minTime);
  const validUntil = toDate(bounds?.maxTime);

  return {
    ok: true,
    tx: {
      hash: toHex(tx.hash()),
      source: tx.source,
      sequence: tx.sequence,
      maxFee: fromStroops(BigInt(tx.fee)),
      ...(memo ? { memo } : {}),
      ...(validFrom ? { validFrom } : {}),
      ...(validUntil ? { validUntil } : {}),
      operations,
      title: titleFor(operations),
      warnings: [...new Set(warnings)],
    },
  };
}

function decodeOperation(
  op: OperationRecord,
  txSource: string,
  context: DecodeContext,
  name: (address: string) => string,
): DecodedOperation {
  const otherSource = op.source && op.source !== txSource ? op.source : undefined;
  const base = (
    text: string,
    flags: OperationFlag[] = [],
    lines: string[] = [],
  ): OperationBase => ({
    type: op.type,
    text,
    lines,
    flags: otherSource ? [...flags, "other-account"] : flags,
    ...(otherSource ? { source: otherSource } : {}),
  });

  switch (op.type) {
    case "payment": {
      const asset = decodeAsset(op.asset, context.usdc);
      const amount = `${formatAmount(op.amount)} ${asset.code}`;
      return {
        ...base(
          `Send ${amount} to ${name(op.destination)}`,
          asset.known ? [] : ["unverified-asset"],
        ),
        kind: "payment",
        destination: op.destination,
        amount: op.amount,
        asset,
      };
    }
    case "createAccount":
      return {
        ...base(
          `Create the account ${name(op.destination)} with ${formatAmount(op.startingBalance)} XLM`,
        ),
        kind: "create_account",
        destination: op.destination,
        startingBalance: op.startingBalance,
      };
    case "changeTrust": {
      if (!(op.line instanceof Asset)) {
        return { ...base("Change a liquidity pool trustline", ["unknown"]), kind: "unknown" };
      }
      const asset = decodeAsset(op.line, context.usdc);
      const removes = Number(op.limit) === 0;
      const text = removes
        ? `Stop accepting ${asset.code}`
        : isMaxLimit(op.limit)
          ? `Start accepting ${asset.code}`
          : `Accept up to ${formatAmount(op.limit)} ${asset.code}`;
      return {
        ...base(text, asset.known ? [] : ["unverified-asset"]),
        kind: "change_trust",
        asset,
        limit: op.limit,
        removes,
      };
    }
    case "setOptions": {
      const { lines, flags } = describeSetOptions(op, context, name);
      return {
        ...base(
          lines.length === 1 ? (lines[0] ?? "") : "Change the account settings",
          flags,
          lines,
        ),
        kind: "set_options",
      };
    }
    default:
      return { ...base(`Unrecognized action: ${humanize(op.type)}`, ["unknown"]), kind: "unknown" };
  }
}

type SetOptions = Extract<OperationRecord, { type: "setOptions" }>;

function describeSetOptions(
  op: SetOptions,
  context: DecodeContext,
  name: (address: string) => string,
): { lines: string[]; flags: OperationFlag[] } {
  const lines: string[] = [];
  const flags = new Set<OperationFlag>();
  const signer = op.signer as
    | { ed25519PublicKey?: string; weight?: number; preAuthTx?: unknown; sha256Hash?: unknown }
    | undefined;

  if (signer) {
    const weight = signer.weight ?? 0;
    if (signer.ed25519PublicKey) {
      const key = signer.ed25519PublicKey;
      const current = context.currentSigners?.find((s) => s.key === key);
      if (weight === 0) lines.push(`Remove ${name(key)} as a signer`);
      else if (current)
        lines.push(`Change ${name(key)}'s weight from ${current.weight} to ${weight}`);
      else lines.push(`Add ${name(key)} as a signer (weight ${weight})`);
    } else {
      lines.push(`${weight === 0 ? "Remove" : "Add"} a special signer Cosignly can't use`);
      flags.add("risky");
    }
  }

  if (op.masterWeight !== undefined) {
    if (op.masterWeight === 0) {
      lines.push("Turn off the account's own key");
    } else {
      lines.push(`Let the account's own key sign (weight ${op.masterWeight})`);
      flags.add("risky");
    }
  }

  const thresholds: string[] = [];
  if (op.medThreshold !== undefined) thresholds.push(`payments need weight ${op.medThreshold}`);
  if (op.highThreshold !== undefined) {
    thresholds.push(`changing signers needs weight ${op.highThreshold}`);
  }
  if (op.lowThreshold !== undefined)
    thresholds.push(`minor actions need weight ${op.lowThreshold}`);
  if (thresholds.length > 0) lines.push(capitalize(thresholds.join(", ")));

  if (op.homeDomain !== undefined) {
    lines.push(op.homeDomain ? `Set the home domain to ${op.homeDomain}` : "Clear the home domain");
  }
  if (op.setFlags !== undefined || op.clearFlags !== undefined) {
    lines.push("Change the account's asset authorization flags");
    flags.add("risky");
  }
  if (op.inflationDest !== undefined) {
    lines.push(`Set the inflation destination to ${name(op.inflationDest)}`);
    flags.add("risky");
  }
  if (lines.length === 0) lines.push("No changes to the account settings");

  return { lines, flags: [...flags] };
}

function decodeAsset(asset: Asset, usdc: AssetRef): DecodedAsset {
  if (asset.isNative()) return { code: "XLM", known: true };
  const ref: AssetRef = { type: "credit", code: asset.getCode(), issuer: asset.getIssuer() ?? "" };
  return { code: ref.code, issuer: ref.issuer, known: isSameAsset(ref, usdc) };
}

function warningFor(
  flag: OperationFlag,
  op: DecodedOperation,
  name: (address: string) => string,
): string {
  switch (flag) {
    case "unknown":
      return `This transaction includes an action Cosignly can't read (${humanize(op.type)}). Only approve it if you know exactly what it does.`;
    case "unverified-asset": {
      const asset = "asset" in op ? op.asset : undefined;
      const issuer = asset?.issuer ? truncateAddress(asset.issuer) : "an unknown issuer";
      return asset?.code === "USDC"
        ? `This "USDC" is issued by ${issuer}, not by Circle. It is not real USDC.`
        : `${asset?.code ?? "This asset"} is issued by ${issuer}. Cosignly only recognizes XLM and USDC.`;
    }
    case "other-account":
      return `An action uses another account (${name(op.source ?? "")}), not this vault.`;
    case "risky":
      return "This changes account settings that can weaken or lock the vault.";
  }
}

function titleFor(operations: readonly DecodedOperation[]): string {
  if (operations.length === 1 && operations[0]) return operations[0].text;
  if (operations.length === 0) return "No actions";
  const payments = operations.filter((op) => op.kind === "payment");
  if (payments.length === operations.length) return `${payments.length} payments`;
  if (operations.every((op) => op.kind === "set_options" && op.flags.length === 0)) {
    return "Change signers and approval rules";
  }
  return `${operations.length} actions`;
}

function decodeMemo(tx: Transaction): DecodedMemo | undefined {
  const { type, value } = tx.memo;
  if (type === "none" || value === null || value === undefined) return undefined;
  if (type === "text") {
    return { type, value: typeof value === "string" ? value : new TextDecoder().decode(value) };
  }
  if (type === "id") return { type, value: String(value) };
  return { type, value: typeof value === "string" ? value : toHex(value) };
}

/** Max trustline limit (int64 max in stroops): "Start accepting" rather than a number. */
function isMaxLimit(limit: string): boolean {
  return limit === "922337203685.4775807";
}

function toDate(seconds: string | undefined): Date | undefined {
  if (!seconds || seconds === "0") return undefined;
  return new Date(Number(seconds) * 1000);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** "manageData" → "manage data". */
function humanize(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
