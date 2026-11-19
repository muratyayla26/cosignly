import { Keypair, StrKey } from "@stellar/stellar-sdk/base";

export type { Keypair };

/**
 * Signer key helpers. A Cosignly signer key is a plain Ed25519 keypair. It
 * does not need a funded account; it only signs for vaults that list it.
 *
 * Nothing in this module logs, stores or sends key material. Error results
 * never echo the input.
 */

/** Generates a new signer keypair from the platform's secure random source. */
export function generateSignerKeypair(): Keypair {
  return Keypair.random();
}

export type SecretKeyParseError =
  /** Nothing was entered. */
  | "empty"
  /** A public address (`G...`) was entered instead of a secret key. */
  | "public-key"
  /** Not a valid Stellar secret key (`S...`). */
  | "invalid";

export type SecretKeyParseResult =
  { ok: true; keypair: Keypair } | { ok: false; error: SecretKeyParseError };

/**
 * Parses a secret key typed or pasted by the user. Whitespace (including line
 * breaks from copying) is removed and letters are upper-cased, because
 * Stellar keys are base32 and case does not carry meaning.
 */
export function parseSecretKey(input: string): SecretKeyParseResult {
  const normalized = input.replace(/\s+/g, "").toUpperCase();
  if (normalized === "") return { ok: false, error: "empty" };
  if (StrKey.isValidEd25519PublicKey(normalized)) return { ok: false, error: "public-key" };
  if (!StrKey.isValidEd25519SecretSeed(normalized)) return { ok: false, error: "invalid" };
  return { ok: true, keypair: Keypair.fromSecret(normalized) };
}

/** User-facing message for a parse error. */
export function secretKeyErrorMessage(error: SecretKeyParseError): string {
  switch (error) {
    case "empty":
      return "Enter your secret key.";
    case "public-key":
      return "This is a public address (starts with G). Enter the secret key, which starts with S.";
    case "invalid":
      return "This is not a valid Stellar secret key. It starts with S and has 56 characters.";
  }
}

/**
 * Signs a random challenge and verifies it with the public key. Proves that a
 * stored key unlocks and matches the expected address.
 */
export function verifyKeypair(keypair: Keypair, expectedPublicKey: string): boolean {
  if (keypair.publicKey() !== expectedPublicKey) return false;
  const challenge = new TextEncoder().encode(`cosignly-key-check-${Date.now()}`);
  return keypair.verify(challenge, keypair.sign(challenge));
}
