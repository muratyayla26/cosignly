import { Keypair, StrKey } from "@stellar/stellar-sdk/base";

export interface CryptoSelfCheck {
  ok: boolean;
  /** Short reason when `ok` is false. Never contains key material. */
  error?: string;
}

/**
 * Generates a throwaway Ed25519 key, signs and verifies a message, and checks
 * that a wrong message fails. Used at app start to prove the runtime has
 * secure randomness and working Ed25519 (polyfills in place) before any real
 * key is created. The key is discarded immediately.
 */
export function cryptoSelfCheck(): CryptoSelfCheck {
  try {
    const keypair = Keypair.random();
    if (!StrKey.isValidEd25519PublicKey(keypair.publicKey())) {
      return { ok: false, error: "generated key is invalid" };
    }
    const message = new TextEncoder().encode("cosignly-self-check");
    const signature = keypair.sign(message);
    if (!keypair.verify(message, signature))
      return { ok: false, error: "signature did not verify" };
    const tampered = new TextEncoder().encode("cosignly-self-check!");
    if (keypair.verify(tampered, signature))
      return { ok: false, error: "tampered message verified" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown error" };
  }
}
