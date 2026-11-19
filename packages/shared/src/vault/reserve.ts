import { fromStroops, toStroops } from "../amount";
import type { AccountInfo } from "../horizon/client";

/**
 * Base reserve per ledger entry. Verified on testnet 2026-11-19
 * (`base_reserve_in_stroops: 5000000`). It is a network setting that changes
 * only by validator vote, so a constant is fine for Sprint 1.
 */
export const BASE_RESERVE_STROOPS = 5_000_000n;

export interface XlmReserve {
  /** XLM the network requires the account to keep (7-decimal string). */
  minimumBalance: string;
  /** XLM the vault can actually send: balance − minimum − amounts locked in offers, never below 0. */
  available: string;
}

/**
 * Minimum balance = (2 + subentries + sponsoring − sponsored) × base reserve.
 * Every signer and trustline is a subentry, so each adds 0.5 XLM.
 */
export function xlmReserve(account: AccountInfo): XlmReserve {
  const entries =
    2n +
    BigInt(account.subentryCount) +
    BigInt(account.numSponsoring) -
    BigInt(account.numSponsored);
  const minimum = entries * BASE_RESERVE_STROOPS;
  const native = account.balances.find((b) => b.asset.type === "native");
  const balance = native ? toStroops(native.balance) : 0n;
  const locked = native?.sellingLiabilities ? toStroops(native.sellingLiabilities) : 0n;
  const available = balance - minimum - locked;
  return {
    minimumBalance: fromStroops(minimum),
    available: fromStroops(available > 0n ? available : 0n),
  };
}
