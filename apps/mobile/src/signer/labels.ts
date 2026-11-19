import { Platform } from "react-native";

import { SignerKeyError } from "./keyStore";

/** How the biometric check is called on this platform, for button labels and copy. */
export const biometricName = Platform.OS === "ios" ? "Face ID" : "your fingerprint";

/** Anything thrown by the signer key functions, as a `SignerKeyError`. */
export function toSignerError(e: unknown): SignerKeyError {
  return e instanceof SignerKeyError ? e : new SignerKeyError("failed");
}
