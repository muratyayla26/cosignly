import { parseSecretKey, verifyKeypair, type Keypair } from "@cosignly/shared";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Storage for the signer key.
 *
 * The Ed25519 signing key is encrypted and stored in the iOS Keychain / Android
 * Keystore, protected by biometrics (Secure Enclave / hardware-backed keystore).
 * It is decrypted on the device only after biometric confirmation to sign a
 * transaction, and is never sent to the backend.
 *
 * Rules for this file: never log, return in an error, or persist anywhere else
 * the secret key. Callers get a `Keypair` only inside `unlockSignerKey`.
 */

const PUBLIC_KEY_ITEM = "cosignly.signer.publicKey";
const SECRET_KEY_ITEM = "cosignly.signer.secretKey";
// Items stored with `requireAuthentication` must use their own keychain service
// (on Android this is the Keystore key alias).
const BIOMETRIC_SERVICE = "cosignly.signer.biometric";

const publicOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

function secretOptions(prompt: string): SecureStore.SecureStoreOptions {
  return {
    keychainService: BIOMETRIC_SERVICE,
    requireAuthentication: true,
    authenticationPrompt: prompt,
    // Never leaves this device (no iCloud Keychain, no backup restore elsewhere);
    // removed by iOS if the device passcode is turned off.
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  };
}

export type SignerKeyErrorKind =
  /** The user cancelled or dismissed the biometric prompt. */
  | "cancelled"
  /** The key can no longer be decrypted (biometrics changed or passcode removed). */
  | "invalidated"
  /** Face ID / fingerprint is not set up, or the device cannot protect the key. */
  | "biometrics-unavailable"
  /** Anything else. The message is generic and never contains key material. */
  | "failed";

export class SignerKeyError extends Error {
  constructor(
    readonly kind: SignerKeyErrorKind,
    /**
     * The native error text, shown only in development builds to diagnose setup
     * problems. Native SecureStore errors describe the failure, never the value.
     */
    readonly detail?: string,
  ) {
    super(`Signer key error: ${kind}`);
    this.name = "SignerKeyError";
  }
}

/** Maps native SecureStore errors to a kind without keeping their text. */
function toSignerKeyError(e: unknown): SignerKeyError {
  if (e instanceof SignerKeyError) return e;
  const detail = e instanceof Error ? e.message : undefined;
  const message = detail?.toLowerCase() ?? "";
  if (message.includes("cancel")) return new SignerKeyError("cancelled", detail);
  if (
    message.includes("enrolled") ||
    message.includes("no hardware") ||
    message.includes("unsupported") ||
    message.includes("passcode")
  ) {
    return new SignerKeyError("biometrics-unavailable", detail);
  }
  return new SignerKeyError("failed", detail);
}

/** Whether this device can store a key behind Face ID / fingerprint. */
export function canProtectWithBiometrics(): boolean {
  try {
    return SecureStore.canUseBiometricAuthentication();
  } catch {
    return false;
  }
}

/** The stored signer's public address, or `null` if this device has no key. No prompt. */
export async function loadSignerPublicKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(PUBLIC_KEY_ITEM, publicOptions);
}

/**
 * Saves a keypair as this device's signer key, replacing any existing one.
 * Shows the biometric prompt: on Android when writing; on iOS (which only
 * prompts on read) by reading the key back once, which also proves the key
 * unlocks before the user relies on it.
 */
export async function saveSignerKey(keypair: Keypair, prompt: string): Promise<void> {
  if (!canProtectWithBiometrics()) throw new SignerKeyError("biometrics-unavailable");
  const publicKey = keypair.publicKey();
  try {
    await deleteSignerKey();
    await SecureStore.setItemAsync(SECRET_KEY_ITEM, keypair.secret(), secretOptions(prompt));
    if (Platform.OS === "ios") await readKeypair(publicKey, prompt);
    await SecureStore.setItemAsync(PUBLIC_KEY_ITEM, publicKey, publicOptions);
  } catch (e) {
    // Leave no half-saved key behind.
    await deleteSignerKey().catch(() => undefined);
    throw toSignerKeyError(e);
  }
}

async function readKeypair(expectedPublicKey: string, prompt: string): Promise<Keypair> {
  const secret = await SecureStore.getItemAsync(SECRET_KEY_ITEM, secretOptions(prompt));
  // SecureStore resolves null when the system invalidated the key.
  if (secret === null) throw new SignerKeyError("invalidated");
  const parsed = parseSecretKey(secret);
  if (!parsed.ok || !verifyKeypair(parsed.keypair, expectedPublicKey)) {
    throw new SignerKeyError("failed");
  }
  return parsed.keypair;
}

/**
 * Asks for Face ID / fingerprint, decrypts the key and passes it to `withKey`.
 * The keypair must not be kept after `withKey` returns.
 */
export async function unlockSignerKey<T>(
  prompt: string,
  withKey: (keypair: Keypair) => T | Promise<T>,
): Promise<T> {
  const publicKey = await loadSignerPublicKey();
  if (publicKey === null) throw new SignerKeyError("invalidated");
  let keypair: Keypair;
  try {
    keypair = await readKeypair(publicKey, prompt);
  } catch (e) {
    throw toSignerKeyError(e);
  }
  return await withKey(keypair);
}

/** Removes the signer key from this device. No prompt. */
export async function deleteSignerKey(): Promise<void> {
  await SecureStore.deleteItemAsync(PUBLIC_KEY_ITEM, publicOptions);
  await SecureStore.deleteItemAsync(SECRET_KEY_ITEM, { keychainService: BIOMETRIC_SERVICE });
}

/** User-facing text for each error kind. */
export function signerKeyErrorMessage(kind: SignerKeyErrorKind): {
  title: string;
  message: string;
} {
  switch (kind) {
    case "cancelled":
      return {
        title: "Not confirmed",
        message: "Confirm with Face ID or your fingerprint to continue.",
      };
    case "invalidated":
      return {
        title: "This key can no longer be unlocked",
        message:
          "Your phone's Face ID, fingerprint or passcode settings changed, so the system locked the stored key. Remove it and set up a new key. The other signers of your vaults can replace your old key.",
      };
    case "biometrics-unavailable":
      return {
        title: "Set up Face ID or fingerprint",
        message:
          "Cosignly protects your key with your phone's biometrics. Turn on Face ID or add a fingerprint in your phone's settings, then try again.",
      };
    case "failed":
      return {
        title: "Something went wrong",
        message: "The key could not be used. Please try again.",
      };
  }
}
