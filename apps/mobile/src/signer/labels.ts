import { Platform } from "react-native";

import { SignerKeyError, type SignerKeyErrorKind } from "./keyStore";

/** How the biometric check is called on this platform, for button labels and copy. */
export const biometricName = Platform.OS === "ios" ? "Face ID" : "your fingerprint";

/** The error kind of anything thrown by the signer key functions. */
export function signerErrorKind(e: unknown): SignerKeyErrorKind {
  return e instanceof SignerKeyError ? e.kind : "failed";
}
