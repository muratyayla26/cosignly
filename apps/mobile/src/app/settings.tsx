import Constants from "expo-constants";
import { router } from "expo-router";
import { Fingerprint, Trash2 } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { AddressChip, Banner, Button, Card, QrCode, SegmentedControl, Text } from "@/components";
import { network } from "@/lib/stellar";
import {
  biometricName,
  SignerErrorBanner,
  toSignerError,
  useSigner,
  type SignerKeyError,
} from "@/signer";
import { screenPadding, space, useTheme, type AppearancePreference } from "@/theme";

const APPEARANCE_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const satisfies readonly { value: AppearancePreference; label: string }[];

type UnlockResult = { kind: "ok" } | { kind: "error"; error: SignerKeyError };

export default function SettingsScreen() {
  const { preference, setPreference } = useTheme();
  const { state, unlock, removeKey } = useSigner();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UnlockResult | null>(null);

  if (state.status !== "ready") return null;
  const { publicKey } = state;

  const checkUnlock = async () => {
    setChecking(true);
    setResult(null);
    try {
      // Decrypts the key behind biometrics and signs a test message; nothing is sent.
      await unlock("Unlock your Cosignly signer key", () => undefined);
      setResult({ kind: "ok" });
    } catch (e) {
      setResult({ kind: "error", error: toSignerError(e) });
    } finally {
      setChecking(false);
    }
  };

  const confirmRemove = () => {
    Alert.alert(
      "Remove signer key?",
      "This deletes the key from this phone. If it only exists here, it is gone for good and the other signers of your vaults must replace it. You can't undo this.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove key",
          style: "destructive",
          onPress: () => {
            void removeKey().then(() => router.replace("/onboarding"));
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Section title="Your signer key">
        <Card>
          <QrCode
            value={publicKey}
            size={180}
            accessibilityLabel="QR code of your public address"
          />
          <View style={styles.center}>
            <AddressChip address={publicKey} name="You" showExplorerLink />
          </View>
          <Text variant="callout" color="textMuted">
            This is your public address. Share it so others can add you as a signer to a vault. Your
            secret key stays encrypted on this phone.
          </Text>
          <Button
            label="Check that my key unlocks"
            variant="secondary"
            icon={Fingerprint}
            fullWidth
            loading={checking}
            onPress={() => void checkUnlock()}
            accessibilityHint={`Asks for ${biometricName}. Nothing is signed or sent.`}
          />
          {result?.kind === "ok" ? (
            <Banner
              tone="success"
              title="Your key works"
              message="It unlocked and matches your public address."
            />
          ) : null}
          {result?.kind === "error" ? <SignerErrorBanner error={result.error} /> : null}
        </Card>
      </Section>

      <Section title="Appearance">
        <SegmentedControl
          accessibilityLabel="Appearance"
          options={APPEARANCE_OPTIONS}
          value={preference}
          onChange={setPreference}
        />
      </Section>

      <Section title="Recovery">
        <Card>
          <Text variant="body">
            There is no backup of your key. If you lose this phone, the other signers of your vaults
            can replace your key with a new one. Your vaults stay safe and keep working.
          </Text>
        </Card>
      </Section>

      <Section title="About">
        <Card>
          <Row label="Network" value={`Stellar ${network.label}`} />
          <Row label="Version" value={Constants.expoConfig?.version ?? "—"} />
        </Card>
      </Section>

      <Button
        label="Remove key from this phone"
        variant="danger"
        icon={Trash2}
        fullWidth
        onPress={confirmRemove}
      />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="caption" color="textMuted" accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="body" color="textMuted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: screenPadding, gap: space.xl, paddingBottom: space.huge },
  section: { gap: space.xs },
  center: { alignItems: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: space.sm, flexWrap: "wrap" },
});
