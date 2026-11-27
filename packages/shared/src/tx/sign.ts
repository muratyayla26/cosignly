import { FeeBumpTransaction, TransactionBuilder, type Keypair } from "@stellar/stellar-sdk/base";

import type { NetworkConfig } from "../network";

/**
 * Adds one signature to a transaction envelope, keeping the signatures it
 * already carries, and returns the new envelope. The key is used only inside
 * this call. Fee-bump envelopes are refused (Cosignly never makes them).
 */
export function addSignatureToEnvelope(
  xdr: string,
  keypair: Keypair,
  network: NetworkConfig,
): string {
  const tx = TransactionBuilder.fromXDR(xdr, network.passphrase);
  if (tx instanceof FeeBumpTransaction)
    throw new TypeError("Fee-bump transactions aren't supported.");
  tx.sign(keypair);
  return tx.toXDR();
}
