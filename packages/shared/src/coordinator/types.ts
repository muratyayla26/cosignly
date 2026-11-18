import type { NetworkId } from "../network";

/**
 * Collects signatures for a proposal until the vault's threshold is met.
 *
 * Sprint 1 has one implementation, `RefractorCoordinator` (W2.4), which uses the
 * Refractor API for classic multisig transactions. Sprint 2 will add a
 * `BackendCoordinator` for smart-account vaults, because Refractor cannot merge
 * Soroban authorization entries. Callers should depend on this interface only.
 */
export interface SignatureCoordinator {
  /** Uploads a transaction signed by the proposer and returns its hash. */
  propose(input: ProposeInput): Promise<ProposalRef>;
  /** Adds the signatures carried by `signedXdr` to an existing proposal. */
  addSignature(input: AddSignatureInput): Promise<CoordinatorStatus>;
  /** Current signatures and submission state of a proposal. */
  getStatus(ref: ProposalRef): Promise<CoordinatorStatus>;
}

export interface ProposalRef {
  network: NetworkId;
  /** Transaction hash (hex), the proposal's identifier. */
  hash: string;
}

export interface ProposeInput {
  network: NetworkId;
  /** Base64 transaction envelope, already signed by the proposer. */
  xdr: string;
  /** Submit to the network automatically once the threshold is reached. */
  submitWhenReady: boolean;
  /** URL the coordinator calls when the proposal changes (Cosignly API, from W3.3). */
  callbackUrl?: string;
  /** When the coordinator may forget the proposal (usually the transaction's max time). */
  expiresAt?: Date;
}

export interface AddSignatureInput {
  network: NetworkId;
  /** Base64 envelope of the same transaction, carrying one or more new signatures. */
  signedXdr: string;
}

/**
 * Coordinator-level state. The app maps this to the user-facing proposal
 * lifecycle (pending → submitted → executed / failed / expired / stale) in W3.5.
 * Refractor's own status values are undocumented; the mapping is defined when
 * `RefractorCoordinator` is implemented.
 */
export type CoordinatorState = "collecting" | "ready" | "submitted" | "failed" | "expired";

export interface CoordinatorStatus extends ProposalRef {
  state: CoordinatorState;
  /** Latest envelope with all signatures collected so far. */
  xdr: string;
  /** Public keys (`G...`) that have signed. */
  signedBy: string[];
  /** Validity window of the transaction (time bounds), when set. */
  minTime?: Date;
  maxTime?: Date;
}
