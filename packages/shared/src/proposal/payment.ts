import {
  Account,
  Asset,
  Memo,
  Operation,
  StrKey,
  TransactionBuilder,
  type Transaction,
} from "@stellar/stellar-sdk/base";

import { fromStroops, toStroops } from "../amount";
import { isSameAsset, XLM, type AssetRef } from "../assets";
import { formatAmount } from "../format";
import type { AccountInfo } from "../horizon/client";
import type { NetworkConfig } from "../network";
import { activeSigners } from "../vault/rules";
import { xlmReserve } from "../vault/reserve";
import type { VaultConfig } from "../vault/types";

/**
 * Payment proposals (W2.4): one payment from a vault, valid for 7 days. The
 * proposer signs it on the phone and uploads it to the signature coordinator;
 * the other signers add their signatures until the payment threshold is met.
 */

/** Proposals expire after 7 days (CLAUDE.md §5). */
export const PROPOSAL_VALIDITY_SECONDS = 7 * 24 * 60 * 60;
/** Max fee per operation in stroops (0.0001 XLM). The network charges only what it needs. */
export const PROPOSAL_FEE_PER_OP = "1000";
/** Stellar text memos hold at most 28 bytes (UTF-8). */
export const MAX_MEMO_BYTES = 28;

export type ProposalAssetCode = "XLM" | "USDC";

export interface PaymentDraft {
  asset: ProposalAssetCode;
  /** Recipient address (`G...`). */
  destination: string;
  /** Decimal amount as typed ("500", "12.5"). */
  amount: string;
  /** Optional text memo. */
  memo: string;
}

export type PaymentField = "destination" | "amount" | "memo" | "asset";

export interface PaymentIssue {
  field: PaymentField;
  message: string;
}

export interface PaymentCheckContext {
  vault: AccountInfo;
  /**
   * The recipient's account from Horizon: `null` if it doesn't exist,
   * `undefined` if it hasn't been looked up (only the format is checked then).
   */
  recipient: AccountInfo | null | undefined;
  usdc: AssetRef;
}

/** Problems with a draft, in plain language. Empty = it can be proposed. */
export function checkPaymentDraft(
  draft: PaymentDraft,
  context: PaymentCheckContext,
): PaymentIssue[] {
  const issues: PaymentIssue[] = [];
  const { vault, recipient, usdc } = context;
  const asset = draft.asset === "USDC" ? usdc : XLM;
  const destination = draft.destination.trim().toUpperCase();

  // Asset: the vault must hold it.
  const vaultBalance = vault.balances.find((b) => isSameAsset(b.asset, asset));
  if (!vaultBalance) {
    issues.push({ field: "asset", message: `This vault can't hold ${draft.asset}.` });
  }

  // Recipient.
  if (destination === "") {
    issues.push({ field: "destination", message: "Enter the recipient's Stellar address." });
  } else if (StrKey.isValidEd25519SecretSeed(destination)) {
    issues.push({
      field: "destination",
      message: "This is a secret key. Enter the recipient's public address (it starts with G).",
    });
  } else if (!StrKey.isValidEd25519PublicKey(destination)) {
    issues.push({
      field: "destination",
      message: "This is not a valid Stellar address. It starts with G and has 56 characters.",
    });
  } else if (destination === vault.id) {
    issues.push({ field: "destination", message: "This is the vault's own address." });
  } else if (recipient === null) {
    issues.push({
      field: "destination",
      message:
        "This account doesn't exist on Stellar yet. Payments can only go to existing accounts.",
    });
  } else if (recipient && draft.asset === "USDC") {
    const line = recipient.balances.find((b) => isSameAsset(b.asset, usdc));
    if (!line) {
      issues.push({
        field: "destination",
        message:
          "The recipient can't receive USDC yet. They need to add USDC to their account first.",
      });
    } else if (isAmount(draft.amount) && line.limit !== undefined) {
      const room = toStroops(line.limit) - toStroops(line.balance);
      if (toStroops(draft.amount) > room) {
        issues.push({
          field: "amount",
          message: `The recipient can receive at most ${formatAmount(fromStroops(room))} USDC more.`,
        });
      }
    }
  }

  // Amount.
  if (!isAmount(draft.amount)) {
    issues.push({
      field: "amount",
      message: "Enter an amount greater than 0, with up to 7 decimal places.",
    });
  } else if (vaultBalance) {
    const available = availableToSend(vault, asset);
    if (toStroops(draft.amount) > toStroops(available)) {
      issues.push({
        field: "amount",
        message: `The vault can send at most ${formatAmount(available)} ${draft.asset}.`,
      });
    }
  }

  // Memo.
  if (new TextEncoder().encode(draft.memo).length > MAX_MEMO_BYTES) {
    issues.push({
      field: "memo",
      message: `The note can be at most ${MAX_MEMO_BYTES} characters.`,
    });
  }

  return issues;
}

/**
 * What the vault can send of an asset. For XLM this keeps the minimum balance
 * and the proposal's maximum fee; for USDC it is the balance.
 */
export function availableToSend(vault: AccountInfo, asset: AssetRef): string {
  if (asset.type === "native") {
    const free = toStroops(xlmReserve(vault).available) - BigInt(PROPOSAL_FEE_PER_OP);
    return fromStroops(free > 0n ? free : 0n);
  }
  const line = vault.balances.find((b) => isSameAsset(b.asset, asset));
  const balance = line ? toStroops(line.balance) : 0n;
  const locked = line?.sellingLiabilities ? toStroops(line.sellingLiabilities) : 0n;
  return fromStroops(balance - locked > 0n ? balance - locked : 0n);
}

function isAmount(amount: string): boolean {
  return /^\d+(\.\d{1,7})?$/.test(amount.trim()) && toStroops(amount.trim()) > 0n;
}

export interface BuildPaymentProposalInput {
  vault: AccountInfo;
  draft: PaymentDraft;
  usdc: AssetRef;
  network: NetworkConfig;
  /** Defaults to now; the proposal expires 7 days later. */
  now?: Date;
}

/**
 * The unsigned proposal transaction, built on the vault's current sequence
 * number. Throws if the draft has problems the caller didn't check.
 */
export function buildPaymentProposal(input: BuildPaymentProposalInput): Transaction {
  const { vault, draft, usdc, network } = input;
  const formatIssues = checkPaymentDraft(draft, { vault, recipient: undefined, usdc });
  if (formatIssues.length > 0) throw new TypeError(formatIssues[0]?.message);
  if (usdc.type !== "credit") throw new TypeError("USDC must be an issued asset.");

  const asset = draft.asset === "USDC" ? new Asset(usdc.code, usdc.issuer) : Asset.native();
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const builder = new TransactionBuilder(new Account(vault.id, vault.sequence), {
    fee: PROPOSAL_FEE_PER_OP,
    networkPassphrase: network.passphrase,
    timebounds: { minTime: 0, maxTime: now + PROPOSAL_VALIDITY_SECONDS },
  }).addOperation(
    Operation.payment({
      destination: draft.destination.trim().toUpperCase(),
      asset,
      amount: draft.amount.trim(),
    }),
  );
  if (draft.memo !== "") builder.addMemo(Memo.text(draft.memo));
  return builder.build();
}

export interface ApprovalProgress {
  /** Signers (with weight > 0) whose signatures count. Others are ignored. */
  approvedBy: string[];
  /** Approvals so far, as a count (equal weights) or total weight. */
  approvals: number;
  /** Approvals needed: signer count (equal weights) or the threshold weight. */
  required: number;
  /** `true` when approvals count signers; `false` when they count weight. */
  countsSigners: boolean;
  /** The threshold is met. */
  complete: boolean;
}

/**
 * Progress towards a vault's payment threshold (medium) for a set of signers.
 * With equal weights it counts signers ("1 of 2"); otherwise weight.
 */
export function approvalProgress(
  vault: VaultConfig,
  signedBy: readonly string[],
): ApprovalProgress {
  const signers = activeSigners(vault);
  const threshold = Math.max(vault.thresholds.medium, 1);
  const approved = signers.filter((s) => signedBy.includes(s.key));
  const weight = approved.reduce((sum, s) => sum + s.weight, 0);
  const equal = signers.every((s) => s.weight === signers[0]?.weight);
  const unit = signers[0]?.weight ?? 1;
  return {
    approvedBy: approved.map((s) => s.key),
    approvals: equal ? approved.length : weight,
    required: equal ? Math.ceil(threshold / unit) : threshold,
    countsSigners: equal,
    complete: weight >= threshold,
  };
}
