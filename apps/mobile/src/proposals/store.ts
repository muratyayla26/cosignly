import {
  RefractorError,
  type AccountInfo,
  type CoordinatorStatus,
  type SignatureCoordinator,
} from "@cosignly/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { network } from "@/lib/stellar";

/**
 * Proposals this phone created, one per vault (v1 allows a single pending
 * proposal per vault). Kept on the phone until the Cosignly API indexes
 * proposals for every signer (W3). Not secret: hashes and titles only.
 */
export const PROPOSALS_STORAGE_KEY = "cosignly.proposals";

export interface LocalProposal {
  vaultId: string;
  /** Transaction hash; the proposal's id on the coordinator. */
  hash: string;
  /** Plain-language title, e.g. "Send 25 XLM to GABC…WXYZ". */
  title: string;
  /** The transaction's sequence number. Once the vault's sequence reaches it, the proposal is used up. */
  sequence: string;
  createdAt: string;
  expiresAt?: string;
}

type Stored = Record<string, LocalProposal>;

async function loadAll(): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(PROPOSALS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

export async function loadLocalProposal(vaultId: string): Promise<LocalProposal | null> {
  return (await loadAll())[vaultId] ?? null;
}

export async function saveLocalProposal(proposal: LocalProposal): Promise<void> {
  const all = await loadAll();
  all[proposal.vaultId] = proposal;
  await AsyncStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(all));
}

export async function removeLocalProposal(vaultId: string): Promise<void> {
  const rest = Object.fromEntries(Object.entries(await loadAll()).filter(([id]) => id !== vaultId));
  await AsyncStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(rest));
}

export interface PendingProposal {
  local: LocalProposal;
  status: CoordinatorStatus;
  /**
   * Still waiting for approvals: collecting or ready, not expired, and the
   * vault hasn't used its sequence number for something else.
   */
  open: boolean;
  /** Another transaction from the vault went first, so this one can never be submitted. */
  stale: boolean;
}

/**
 * The vault's proposal from this phone with its latest status, or `null`.
 * A proposal the coordinator no longer knows is forgotten.
 */
export async function loadPendingProposal(
  vault: AccountInfo,
  coordinator: SignatureCoordinator,
): Promise<PendingProposal | null> {
  const local = await loadLocalProposal(vault.id);
  if (!local) return null;
  let status: CoordinatorStatus;
  try {
    status = await coordinator.getStatus({ network: network.id, hash: local.hash });
  } catch (e) {
    if (e instanceof RefractorError && e.status === 404) {
      await removeLocalProposal(vault.id);
      return null;
    }
    throw e;
  }
  const waiting = status.state === "collecting" || status.state === "ready";
  const stale = waiting && BigInt(vault.sequence) >= BigInt(local.sequence);
  return { local, status, open: waiting && !stale, stale };
}
