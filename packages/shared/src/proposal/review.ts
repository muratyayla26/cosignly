import type { CoordinatorStatus } from "../coordinator/types";
import type { VaultConfig } from "../vault/types";
import { approvalProgress, type ApprovalProgress } from "./payment";

/**
 * Where a proposal stands, from a signer's point of view (W2.5):
 * - `collecting`: waiting for approvals.
 * - `sending`: enough approvals; the coordinator is submitting it.
 * - `executed`: applied on Stellar.
 * - `failed`: Stellar rejected it.
 * - `expired`: its time bounds passed first.
 * - `stale`: another transaction from the vault used its sequence number, so
 *   it can never be submitted (v1 "recreate" case).
 */
export type ProposalPhase = "collecting" | "sending" | "executed" | "failed" | "expired" | "stale";

export interface ProposalReviewInput {
  vault: VaultConfig;
  /** The vault account's current sequence number (Horizon). */
  vaultSequence: string;
  /** The proposal transaction's sequence number. */
  txSequence: string;
  status: CoordinatorStatus;
  /** This phone's signer key. */
  signer: string;
}

export interface ProposalReview {
  phase: ProposalPhase;
  progress: ApprovalProgress;
  isSigner: boolean;
  hasSigned: boolean;
  /** This signer may add a signature now. */
  canApprove: boolean;
  /** Why not, in plain language (only when `canApprove` is false and approving would otherwise make sense to ask). */
  reason?: string;
}

/**
 * Decides what a signer can do with a proposal. A signature is never added
 * once the threshold is met: extra signatures make Stellar reject the whole
 * transaction (`tx_bad_auth_extra`).
 */
export function reviewProposal(input: ProposalReviewInput): ProposalReview {
  const { vault, status, signer } = input;
  const progress = approvalProgress(vault, status.signedBy);
  const isSigner = vault.signers.some((s) => s.key === signer && s.weight > 0);
  const hasSigned = status.signedBy.includes(signer);
  const waiting = status.state === "collecting" || status.state === "ready";
  const stale = waiting && BigInt(input.vaultSequence) >= BigInt(input.txSequence);

  const phase: ProposalPhase = stale
    ? "stale"
    : status.state === "collecting"
      ? progress.complete
        ? "sending"
        : "collecting"
      : status.state === "ready"
        ? "sending"
        : status.state === "submitted"
          ? "executed"
          : status.state;

  let reason: string | undefined;
  if (phase === "collecting") {
    if (!isSigner) reason = "Your key isn't a signer of this vault, so you can't approve.";
    else if (hasSigned) reason = "You approved this payment.";
  }
  const canApprove = phase === "collecting" && isSigner && !hasSigned && !progress.complete;

  return { phase, progress, isSigner, hasSigned, canApprove, ...(reason ? { reason } : {}) };
}
