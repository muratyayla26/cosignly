import { parseSecretKey, secretKeyErrorMessage } from "@cosignly/shared";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { ClipboardPaste, Fingerprint } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";

import { Banner, Button, Text, TextField } from "@/components";
import {
  biometricName,
  signerErrorKind,
  signerKeyErrorMessage,
  useSigner,
  type SignerKeyErrorKind,
} from "@/signer";
import { screenPadding, space } from "@/theme";

/** Import an existing Stellar secret key (`S...`) as this phone's signer key. */
export default function ImportKeyScreen() {
  const { importKey } = useSigner();
  const [secret, setSecret] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<SignerKeyErrorKind | null>(null);
  const [busy, setBusy] = useState(false);

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    setSecret(text);
    setInputError(null);
    // Do not leave a secret key sitting in the clipboard.
    if (text) await Clipboard.setStringAsync("");
  };

  const submit = async () => {
    const parsed = parseSecretKey(secret);
    if (!parsed.ok) {
      setInputError(secretKeyErrorMessage(parsed.error));
      return;
    }
    setInputError(null);
    setStoreError(null);
    setBusy(true);
    try {
      await importKey(parsed.keypair);
      setSecret("");
      router.replace("/onboarding/ready");
    } catch (e) {
      setStoreError(signerErrorKind(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="body" color="textMuted">
          Enter the secret key of a Stellar account you control. It starts with S and has 56
          characters. Cosignly will use it to sign for the vaults that list its public address.
        </Text>

        <TextField
          label="Secret key"
          value={secret}
          onChangeText={(t) => {
            setSecret(t);
            setInputError(null);
          }}
          placeholder="S…"
          error={inputError}
          mono
          secureTextEntry
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          importantForAutofill="no"
          textContentType="none"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
        <Button
          label="Paste from clipboard"
          variant="ghost"
          icon={ClipboardPaste}
          onPress={() => void paste()}
          accessibilityHint="Pastes the key and then clears the clipboard"
        />

        <Banner
          tone="warning"
          title="Keep your secret key private"
          message="Anyone with this key can sign for your vaults. Cosignly will never ask you for it again, and never sends it anywhere."
        />

        {storeError ? (
          <Banner
            tone={storeError === "cancelled" ? "info" : "danger"}
            {...signerKeyErrorMessage(storeError)}
          />
        ) : null}

        <Button
          label="Use this key"
          icon={Fingerprint}
          fullWidth
          loading={busy}
          onPress={() => void submit()}
          accessibilityHint={`Saves the key on this phone and asks for ${biometricName}`}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: screenPadding, gap: space.md, paddingBottom: space.huge },
});
