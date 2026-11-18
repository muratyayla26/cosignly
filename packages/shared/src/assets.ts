import type { NetworkId } from "./network";

/** A classic Stellar asset: native XLM, or a code issued by a `G...` account. */
export type AssetRef = { type: "native" } | { type: "credit"; code: string; issuer: string };

export const XLM: AssetRef = { type: "native" };

/**
 * Circle's USDC as a classic asset, per network. The `G...` issuer is what
 * trustlines and payments use. (USDC's `C...` Stellar Asset Contract address is
 * a different thing and is not used in Sprint 1.)
 *
 * Testnet issuer verified on 2026-11-18 against developers.stellar.org and Horizon
 * testnet (home_domain `centre.io`).
 */
const USDC_ISSUERS: Partial<Record<NetworkId, string>> = {
  testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
};

export function getUsdc(network: NetworkId): AssetRef {
  const issuer = USDC_ISSUERS[network];
  if (!issuer) throw new Error(`USDC is not configured for network "${network}".`);
  return { type: "credit", code: "USDC", issuer };
}

/** Display code for an asset ("XLM", "USDC"). */
export function assetCode(asset: AssetRef): string {
  return asset.type === "native" ? "XLM" : asset.code;
}

export function isSameAsset(a: AssetRef, b: AssetRef): boolean {
  if (a.type === "native" || b.type === "native") return a.type === b.type;
  return a.code === b.code && a.issuer === b.issuer;
}
