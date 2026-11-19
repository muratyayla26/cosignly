import { router, useLocalSearchParams } from "expo-router";
import {
  Fingerprint,
  ShieldCheck,
  Smartphone,
  UsersRound,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";

import { Banner, Button, Card, Icon, Text } from "@/components";
import {
  biometricName,
  canProtectWithBiometrics,
  SignerErrorBanner,
  signerKeyErrorMessage,
  toSignerError,
  useSigner,
  type SignerKeyError,
} from "@/signer";
import { screenPadding, space } from "@/theme";

const FACTS: { icon: LucideIcon; text: string }[] = [
  {
    icon: Smartphone,
    text: "Your signer key is created and kept on this phone only. Cosignly does not copy it anywhere, so there is no cloud backup.",
  },
  {
    icon: Fingerprint,
    text: `Every approval needs ${biometricName}. Nobody can use the key without unlocking it on this phone.`,
  },
  {
    icon: UsersRound,
    text: "If you lose this phone, your vaults stay safe: the other signers approve a change that replaces your old key with a new one.",
  },
  {
    icon: ShieldCheck,
    text: "That is why Cosignly checks, when a vault is set up, that the other signers can still make changes if one signer is lost.",
  },
];

/** Explains recovery before the user creates or imports a key. */
export default function RecoveryScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const isImport = next === "import";
  const { createKey } = useSigner();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SignerKeyError | null>(null);
  const biometricsReady = canProtectWithBiometrics();

  const onContinue = async () => {
    if (isImport) {
      router.push("/onboarding/import");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createKey();
      router.replace("/onboarding/ready");
    } catch (e) {
      setError(toSignerError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="title" accessibilityRole="header">
        How recovery works
      </Text>

      <Card>
        {FACTS.map((f) => (
          <View key={f.text} style={styles.fact}>
            <Icon icon={f.icon} color="primary" />
            <Text variant="body" style={styles.factText}>
              {f.text}
            </Text>
          </View>
        ))}
      </Card>

      {Platform.OS === "android" ? (
        <Banner
          tone="info"
          title="Good to know"
          message="If you add a new fingerprint or face to this phone, Android locks the stored key for safety. You would then set up a new key and the other signers replace the old one."
        />
      ) : null}

      {isImport ? (
        <Text variant="callout" color="textMuted">
          When you use an existing key, Cosignly keeps its own encrypted copy on this phone. Any
          backup you already have of that key is not changed.
        </Text>
      ) : null}

      {!biometricsReady ? (
        <Banner {...signerKeyErrorMessage("biometrics-unavailable")} tone="warning" />
      ) : null}
      {error ? <SignerErrorBanner error={error} /> : null}

      <Button
        label={isImport ? "I understand, continue" : "I understand, create my key"}
        icon={isImport ? undefined : Fingerprint}
        fullWidth
        loading={busy}
        disabled={!biometricsReady}
        onPress={() => void onContinue()}
        accessibilityHint={isImport ? undefined : `Creates your key and asks for ${biometricName}`}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: screenPadding, gap: space.lg, paddingBottom: space.huge },
  fact: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  factText: { flex: 1 },
});
