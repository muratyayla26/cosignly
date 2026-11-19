import { formatAmount } from "../format";
import type { HorizonOperation } from "./types";

export type ActivityKind =
  | "received"
  | "sent"
  | "created"
  | "asset-added"
  | "asset-removed"
  | "signers-changed"
  | "rules-changed"
  | "merged"
  /** An operation Cosignly does not describe (e.g. trading, contracts). Shown flagged. */
  | "other";

/** One line of a vault's history, in plain language. */
export interface VaultActivity {
  id: string;
  kind: ActivityKind;
  /** e.g. "Received 25 XLM", "Added a signer". No jargon. */
  title: string;
  /** The other party (sender, recipient, signer), when there is one. */
  counterparty?: string;
  createdAt: Date;
  transactionHash: string;
}

const code = (op: HorizonOperation) =>
  op.asset_type === "native" ? "XLM" : (op.asset_code ?? "?");
const amount = (value: string | undefined, assetCode: string) =>
  `${formatAmount(value ?? "0")} ${assetCode}`;

/** Describes one Horizon operation from the vault's point of view. */
export function describeOperation(vaultId: string, op: HorizonOperation): VaultActivity {
  const base = {
    id: op.id,
    createdAt: new Date(op.created_at),
    transactionHash: op.transaction_hash,
  };
  const other = (title = "Other activity"): VaultActivity => ({ ...base, kind: "other", title });

  switch (op.type) {
    case "payment":
    case "path_payment_strict_send":
    case "path_payment_strict_receive": {
      if (op.to === vaultId && op.from !== vaultId) {
        return {
          ...base,
          kind: "received",
          title: `Received ${amount(op.amount, code(op))}`,
          ...(op.from ? { counterparty: op.from } : {}),
        };
      }
      if (op.from === vaultId) {
        return {
          ...base,
          kind: "sent",
          title: `Sent ${amount(op.amount, code(op))}`,
          ...(op.to ? { counterparty: op.to } : {}),
        };
      }
      return other();
    }
    case "create_account":
      if (op.account === vaultId) {
        return {
          ...base,
          kind: "created",
          title: `Vault opened with ${amount(op.starting_balance, "XLM")}`,
          ...(op.funder ? { counterparty: op.funder } : {}),
        };
      }
      return {
        ...base,
        kind: "sent",
        title: `Sent ${amount(op.starting_balance, "XLM")} to open a new account`,
        ...(op.account ? { counterparty: op.account } : {}),
      };
    case "change_trust": {
      const assetCode = code(op);
      return toNumber(op.limit) === 0
        ? { ...base, kind: "asset-removed", title: `Stopped accepting ${assetCode}` }
        : { ...base, kind: "asset-added", title: `Started accepting ${assetCode}` };
    }
    case "set_options":
      if (op.signer_key !== undefined) {
        return {
          ...base,
          kind: "signers-changed",
          title: op.signer_weight === 0 ? "Removed a signer" : "Added or updated a signer",
          counterparty: op.signer_key,
        };
      }
      if (
        op.master_key_weight !== undefined ||
        op.low_threshold !== undefined ||
        op.med_threshold !== undefined ||
        op.high_threshold !== undefined
      ) {
        return { ...base, kind: "rules-changed", title: "Changed the approval rules" };
      }
      return other("Changed account settings");
    case "account_merge":
      return {
        ...base,
        kind: "merged",
        title: "Account closed and its XLM moved",
        ...(op.into ? { counterparty: op.into } : {}),
      };
    default:
      return other();
  }
}

function toNumber(value: string | undefined): number {
  return value === undefined ? Number.NaN : Number(value);
}
