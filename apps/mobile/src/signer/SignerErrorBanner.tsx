import { Banner, Text } from "@/components";

import { signerKeyErrorMessage, type SignerKeyError } from "./keyStore";

/** Shows a signer key error in plain language; adds the native reason in dev builds. */
export function SignerErrorBanner({ error }: { error: SignerKeyError }) {
  return (
    <>
      <Banner
        tone={error.kind === "cancelled" ? "info" : "danger"}
        {...signerKeyErrorMessage(error.kind)}
      />
      {__DEV__ && error.detail ? (
        <Text variant="caption" color="textMuted">
          Details (dev only): {error.detail}
        </Text>
      ) : null}
    </>
  );
}
