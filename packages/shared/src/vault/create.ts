import {
  Account,
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  type Transaction,
} from "@stellar/stellar-sdk/base";

import { isSameAsset, type AssetRef } from "../assets";
import { TransactionSubmitError, type AccountInfo, type HorizonClient } from "../horizon/client";
import type { NetworkConfig } from "../network";
import { validateVaultConfig } from "./rules";
import type { VaultConfig } from "./types";

/**
 * Creating a vault (W2.2).
 *
 * 1. A new, random "ephemeral" keypair is generated. Its account becomes the
 *    vault. On testnet, Friendbot funds it.
 * 2. One transaction, signed by that key: USDC trustline, every signer, the
 *    thresholds and master weight 0, in that order (signers are added before
 *    the account's own key is turned off; CLAUDE.md §5 rule 4).
 * 3. The account is read back from Horizon and compared with the wizard's
 *    configuration.
 *
 * After step 2 the ephemeral key has weight 0 and can never sign again. Its
 * secret lives only in this closure while the steps run and is never
 * returned, stored, logged or sent anywhere.
 */

/** Max fee per operation in stroops (0.0001 XLM). The network charges only what it needs. */
export const VAULT_SETUP_FEE_PER_OP = "1000";
/** The setup transaction is valid for 5 minutes. */
export const VAULT_SETUP_TIMEOUT_SECONDS = 300;

export interface BuildVaultSetupInput {
  /** The new vault account (its own key signs this transaction). */
  accountId: string;
  /** Current sequence number of that account, from Horizon. */
  sequence: string;
  config: VaultConfig;
  usdc: AssetRef;
  network: NetworkConfig;
}

/** The single setup transaction (unsigned). Throws if the configuration is not a valid Cosignly vault. */
export function buildVaultSetupTransaction(input: BuildVaultSetupInput): Transaction {
  const { accountId, sequence, config, usdc, network } = input;
  assertCreatable(config);
  if (usdc.type !== "credit") throw new TypeError("USDC must be an issued asset.");

  const builder = new TransactionBuilder(new Account(accountId, sequence), {
    fee: VAULT_SETUP_FEE_PER_OP,
    networkPassphrase: network.passphrase,
  }).addOperation(Operation.changeTrust({ asset: new Asset(usdc.code, usdc.issuer) }));

  for (const signer of config.signers) {
    builder.addOperation(
      Operation.setOptions({ signer: { ed25519PublicKey: signer.key, weight: signer.weight } }),
    );
  }

  // Last: thresholds and turning off the account's own key.
  builder.addOperation(
    Operation.setOptions({
      masterWeight: 0,
      lowThreshold: config.thresholds.low,
      medThreshold: config.thresholds.medium,
      highThreshold: config.thresholds.high,
    }),
  );

  return builder.setTimeout(VAULT_SETUP_TIMEOUT_SECONDS).build();
}

function assertCreatable(config: VaultConfig): void {
  if (config.masterWeight !== 0) {
    throw new TypeError("Cosignly vaults turn off the account's own key (master weight 0).");
  }
  if (!validateVaultConfig(config).valid) {
    throw new TypeError("This vault configuration does not pass the lockout rules.");
  }
}

/** Differences between an on-chain account and the configuration it should have. Empty = match. */
export function compareVaultAccount(
  account: AccountInfo,
  config: VaultConfig,
  usdc: AssetRef,
): string[] {
  const problems: string[] = [];
  if (account.masterWeight !== config.masterWeight) problems.push("master weight");
  const { low, medium, high } = account.thresholds;
  if (
    low !== config.thresholds.low ||
    medium !== config.thresholds.medium ||
    high !== config.thresholds.high
  ) {
    problems.push("thresholds");
  }
  const onChain = new Map(account.signers.map((s) => [s.key, s.weight]));
  const signersMatch =
    onChain.size === config.signers.length &&
    config.signers.every((s) => onChain.get(s.key) === s.weight) &&
    account.otherSigners.length === 0;
  if (!signersMatch) problems.push("signers");
  if (!account.balances.some((b) => isSameAsset(b.asset, usdc))) problems.push("USDC trustline");
  return problems;
}

export type VaultCreationStep = "fund" | "configure" | "verify";

export class VaultCreationError extends Error {
  readonly step: VaultCreationStep;
  /** Horizon result codes when the network rejected the setup transaction. */
  readonly resultCodes: TransactionSubmitError["resultCodes"] | undefined;

  constructor(step: VaultCreationStep, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "VaultCreationError";
    this.step = step;
    this.resultCodes = cause instanceof TransactionSubmitError ? cause.resultCodes : undefined;
  }
}

export interface VaultCreationResult {
  accountId: string;
  /** Hash of the setup transaction (absent only if an earlier attempt applied it but its response was lost). */
  txHash?: string;
  account: AccountInfo;
}

export interface VaultCreation {
  /** The new vault's address, known before anything is sent. */
  readonly accountId: string;
  /**
   * Runs the remaining steps. If a step fails it throws `VaultCreationError`;
   * calling `run` again resumes from that step (no second Friendbot request).
   */
  run(onStep?: (step: VaultCreationStep) => void): Promise<VaultCreationResult>;
}

export interface StartVaultCreationInput {
  config: VaultConfig;
  usdc: AssetRef;
  network: NetworkConfig;
  horizon: HorizonClient;
  /** Defaults to the global `fetch`; used for Friendbot. */
  fetch?: typeof fetch;
}

/** Runs one step; any unexpected error (e.g. offline) becomes a `VaultCreationError` for that step. */
async function step<T>(
  name: VaultCreationStep,
  fn: () => Promise<T>,
  onStep: ((step: VaultCreationStep) => void) | undefined,
): Promise<T> {
  onStep?.(name);
  try {
    return await fn();
  } catch (e) {
    if (e instanceof VaultCreationError) throw e;
    throw new VaultCreationError(
      name,
      "Couldn't reach Stellar. Check your connection and try again.",
      e,
    );
  }
}

/** Prepares a vault creation with a fresh ephemeral key. Nothing is sent until `run()`. */
export function startVaultCreation(input: StartVaultCreationInput): VaultCreation {
  const { config, usdc, network, horizon } = input;
  assertCreatable(config);
  const doFetch = input.fetch ?? globalThis.fetch.bind(globalThis);

  // Held only here. Cleared once the vault is configured (the key is then powerless anyway).
  let keypair: Keypair | null = Keypair.random();
  const accountId = keypair.publicKey();
  let funded = false;
  let txHash: string | undefined;
  let configured = false;

  async function fund() {
    const friendbot = network.friendbotUrl;
    if (!friendbot) throw new VaultCreationError("fund", "This network has no test funds.");
    let ok: boolean;
    try {
      const response = await doFetch(`${friendbot}?addr=${encodeURIComponent(accountId)}`);
      ok = response.ok;
    } catch (e) {
      throw new VaultCreationError("fund", "Couldn't reach Friendbot to fund the vault.", e);
    }
    // A lost response can still have funded the account: check before failing.
    if (!ok && !(await horizon.getAccount(accountId).catch(() => null))) {
      throw new VaultCreationError("fund", "Friendbot couldn't fund the vault. Try again.");
    }
    funded = true;
  }

  async function configure() {
    const account = await horizon.getAccount(accountId);
    if (!account)
      throw new VaultCreationError("configure", "The vault account isn't on Stellar yet.");
    // An earlier attempt may have applied while its response was lost.
    if (compareVaultAccount(account, config, usdc).length === 0) {
      configured = true;
      return;
    }
    if (!keypair)
      throw new VaultCreationError("configure", "The setup key is no longer available.");
    const tx = buildVaultSetupTransaction({
      accountId,
      sequence: account.sequence,
      config,
      usdc,
      network,
    });
    tx.sign(keypair);
    try {
      txHash = (await horizon.submitTransaction(tx.toXDR())).hash;
    } catch (e) {
      throw new VaultCreationError("configure", "Stellar didn't accept the vault setup.", e);
    }
    configured = true;
  }

  async function verify(): Promise<AccountInfo> {
    const account = await horizon.getAccount(accountId);
    const problems = account ? compareVaultAccount(account, config, usdc) : ["account"];
    if (!account || problems.length > 0) {
      throw new VaultCreationError(
        "verify",
        `The vault on Stellar doesn't match the setup (${problems.join(", ")}).`,
      );
    }
    return account;
  }

  return {
    accountId,
    async run(onStep) {
      if (!funded) await step("fund", fund, onStep);
      if (!configured) {
        await step("configure", configure, onStep);
        keypair = null;
      }
      const account = await step("verify", verify, onStep);
      return { accountId, account, ...(txHash ? { txHash } : {}) };
    },
  };
}
