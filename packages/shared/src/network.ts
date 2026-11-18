import { Networks } from "@stellar/stellar-sdk/base";

/**
 * Stellar networks Cosignly knows about. Sprint 1 runs on testnet only; the
 * `public` (mainnet) path exists as a type but is disabled at runtime.
 */
export type NetworkId = "testnet" | "public";

export interface NetworkConfig {
  id: NetworkId;
  /** Human-readable label for UI ("Testnet"). */
  label: string;
  /** Network passphrase used when signing transactions. */
  passphrase: string;
  horizonUrl: string;
  /** Friendbot funds new testnet accounts. Absent on mainnet. */
  friendbotUrl?: string;
  /** Network name used by the Refractor API (`network` field). */
  refractorNetwork: "testnet" | "public";
  /** Base URL for stellar.expert explorer links. */
  explorerUrl: string;
}

export const TESTNET: NetworkConfig = {
  id: "testnet",
  label: "Testnet",
  passphrase: Networks.TESTNET,
  horizonUrl: "https://horizon-testnet.stellar.org",
  friendbotUrl: "https://friendbot.stellar.org",
  refractorNetwork: "testnet",
  explorerUrl: "https://stellar.expert/explorer/testnet",
};

/** The network used unless a caller explicitly asks for another one. */
export const DEFAULT_NETWORK: NetworkId = "testnet";

/** Whether mainnet is enabled. Kept `false` for Sprint 1 (see CLAUDE.md §8). */
export const MAINNET_ENABLED = false;

export function getNetworkConfig(id: NetworkId = DEFAULT_NETWORK): NetworkConfig {
  if (id === "testnet") return TESTNET;
  throw new Error("Mainnet is not enabled in this version of Cosignly.");
}

/** stellar.expert link for an account (`G...`) on the given network. */
export function explorerAccountUrl(network: NetworkConfig, accountId: string): string {
  return `${network.explorerUrl}/account/${accountId}`;
}

/** stellar.expert link for a transaction hash on the given network. */
export function explorerTransactionUrl(network: NetworkConfig, txHash: string): string {
  return `${network.explorerUrl}/tx/${txHash}`;
}
