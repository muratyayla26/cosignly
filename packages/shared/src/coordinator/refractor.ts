import { getNetworkConfig, type NetworkId } from "../network";
import type {
  AddSignatureInput,
  CoordinatorState,
  CoordinatorStatus,
  ProposalRef,
  ProposeInput,
  SignatureCoordinator,
} from "./types";

/**
 * `SignatureCoordinator` backed by Refractor (refractor.space), the Stellar
 * ecosystem's signature collector for classic multisig.
 *
 * Observed on testnet, 2026-11-24 (the API docs don't list these):
 * - Base URL `https://api.refractor.space`; the web UI is `https://refractor.space/tx/<hash>`.
 * - `POST /tx` stores a transaction or merges new signatures into it and
 *   returns the full record plus `changes.accepted` / `changes.rejected`.
 *   Duplicate signatures are ignored; signatures from keys that can't sign
 *   for the account are rejected (the request still returns 200).
 * - `status` goes `pending` → `ready` (threshold met) → `processing`
 *   (submitting) → `processed` (on-chain), or `failed` with `error` such as
 *   "Tx error: txBadSeq". Submission took about 8 s after `ready`.
 * - `xdr` is the envelope with every signature collected so far.
 * - Errors: 400 `{ error, status }` (invalid XDR, already expired), 404 for an
 *   unknown hash, 406 for fee-bump envelopes.
 */

export const REFRACTOR_API_URL = "https://api.refractor.space";
export const REFRACTOR_WEB_URL = "https://refractor.space";

/** Refractor page where co-signers using other wallets can sign. */
export function refractorTxUrl(hash: string): string {
  return `${REFRACTOR_WEB_URL}/tx/${hash}`;
}

/** Refractor's transaction record (fields seen in real responses). */
export interface RefractorTx {
  hash: string;
  network: "public" | "testnet";
  xdr: string;
  signatures: { key: string; signature: string }[];
  status: string;
  submit: boolean;
  minTime: number | null;
  maxTime: number | null;
  error?: string | null;
  submitted?: number | null;
  callbackUrl?: string | null;
  changes?: {
    accepted: { key: string; signature: string }[];
    rejected: { key: string; signature: string }[];
  };
}

export class RefractorError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RefractorError";
    this.status = status;
  }
}

export interface RefractorCoordinatorOptions {
  baseUrl?: string;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Current time, for expiry (tests). */
  now?: () => Date;
}

export function createRefractorCoordinator(
  options: RefractorCoordinatorOptions = {},
): SignatureCoordinator {
  const base = (options.baseUrl ?? REFRACTOR_API_URL).replace(/\/+$/, "");
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const now = options.now ?? (() => new Date());

  async function request(path: string, init?: RequestInit): Promise<RefractorTx> {
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, {
        ...init,
        headers: { Accept: "application/json", "Content-Type": "application/json" },
      });
    } catch (e) {
      throw new RefractorError(0, `Couldn't reach Refractor (${String(e)}).`);
    }
    const body = (await response.json().catch(() => null)) as
      (RefractorTx & { error?: string | null }) | null;
    if (!response.ok || !body) {
      throw new RefractorError(
        response.status,
        body?.error ?? `Refractor request failed with status ${response.status}.`,
      );
    }
    return body;
  }

  async function post(input: {
    network: NetworkId;
    xdr: string;
    submit: boolean;
    callbackUrl?: string;
    expiresAt?: Date;
  }): Promise<RefractorTx> {
    return request("/tx", {
      method: "POST",
      body: JSON.stringify({
        network: getNetworkConfig(input.network).refractorNetwork,
        xdr: input.xdr,
        submit: input.submit,
        ...(input.callbackUrl ? { callbackUrl: input.callbackUrl } : {}),
        ...(input.expiresAt ? { expires: Math.floor(input.expiresAt.getTime() / 1000) } : {}),
      }),
    });
  }

  const toStatus = (network: NetworkId, tx: RefractorTx) => toCoordinatorStatus(network, tx, now());

  return {
    async propose(input: ProposeInput): Promise<ProposalRef> {
      const tx = await post({
        network: input.network,
        xdr: input.xdr,
        submit: input.submitWhenReady,
        ...(input.callbackUrl ? { callbackUrl: input.callbackUrl } : {}),
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      });
      return { network: input.network, hash: tx.hash };
    },

    async addSignature(input: AddSignatureInput): Promise<CoordinatorStatus> {
      // Same endpoint: Refractor merges new signatures into the stored transaction.
      // `submit` stays as set by the proposer.
      return toStatus(
        input.network,
        await post({ network: input.network, xdr: input.signedXdr, submit: true }),
      );
    },

    async getStatus(ref: ProposalRef): Promise<CoordinatorStatus> {
      return toStatus(ref.network, await request(`/tx/${ref.hash}`));
    },
  };
}

/** Maps a Refractor record to the coordinator's state. */
export function toCoordinatorStatus(
  network: NetworkId,
  tx: RefractorTx,
  now: Date,
): CoordinatorStatus {
  const maxTime = tx.maxTime ? new Date(tx.maxTime * 1000) : undefined;
  const minTime = tx.minTime ? new Date(tx.minTime * 1000) : undefined;
  let state = mapState(tx.status);
  if ((state === "collecting" || state === "ready") && maxTime && maxTime <= now) state = "expired";
  return {
    network,
    hash: tx.hash,
    state,
    xdr: tx.xdr,
    signedBy: tx.signatures.map((s) => s.key),
    ...(minTime ? { minTime } : {}),
    ...(maxTime ? { maxTime } : {}),
    ...(tx.error ? { error: tx.error } : {}),
  };
}

function mapState(status: string): CoordinatorState {
  switch (status) {
    case "pending":
      return "collecting";
    case "ready":
    case "processing":
      return "ready";
    case "processed":
      return "submitted";
    case "failed":
      return "failed";
    default:
      // Unknown future value: treat as still collecting, never as success.
      return "collecting";
  }
}
