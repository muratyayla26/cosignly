import {
  decodeTransaction,
  RefractorError,
  settleWithLedger,
  type AccountInfo,
  type CoordinatorStatus,
} from "@cosignly/shared";

import { coordinator, horizon, network, usdc } from "@/lib/stellar";

export interface ProposalData {
  status: CoordinatorStatus;
  /** The proposal's source account (the vault), or `null` if it no longer exists. */
  vault: AccountInfo | null;
}

/**
 * A proposal by hash: its latest status from the coordinator (corrected by the
 * ledger when the coordinator lags) and its vault from Horizon. `null` if the
 * coordinator doesn't know the hash.
 */
export async function loadProposal(hash: string): Promise<ProposalData | null> {
  let status: CoordinatorStatus;
  try {
    status = await coordinator.getStatus({ network: network.id, hash });
  } catch (e) {
    if (e instanceof RefractorError && e.status === 404) return null;
    throw e;
  }
  const decoded = decodeTransaction(status.xdr, { network, usdc });
  const vault = decoded.ok ? await horizon.getAccount(decoded.tx.source) : null;
  // Refractor can lag a few seconds behind the ledger; don't mistake that for "stale".
  if (vault && decoded.ok) {
    status = await settleWithLedger(status, vault.sequence, decoded.tx.sequence, horizon);
  }
  return { status, vault };
}
