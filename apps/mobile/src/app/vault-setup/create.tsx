import {
  explorerTransactionUrl,
  getUsdc,
  reviewGate,
  startVaultCreation,
  validateVaultConfig,
  VaultCreationError,
  type VaultCreation,
  type VaultCreationResult,
  type VaultCreationStep,
} from "@cosignly/shared";
import * as Linking from "expo-linking";
import { router, Stack } from "expo-router";
import { Circle, CircleCheck, ExternalLink, RotateCcw, ShieldCheck } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { AddressChip, Banner, Button, Card, Icon, Text } from "@/components";
import { horizon, network } from "@/lib/stellar";
import { screenPadding, space, useTheme } from "@/theme";
import { configFromState, trimmedName } from "@/vaultSetup/state";
import { useVaultSetup } from "@/vaultSetup/VaultSetupProvider";
import { useVaultNames } from "@/vaults/names";

const STEPS: readonly { step: VaultCreationStep; label: string }[] = [
  {
    step: "fund",
    label: `Creating the vault account with free ${network.label.toLowerCase()} XLM`,
  },
  { step: "configure", label: "Adding the signers and approval rules" },
  { step: "verify", label: "Checking the vault on Stellar" },
];

type Phase =
  | { kind: "running"; step: VaultCreationStep }
  | { kind: "failed"; step: VaultCreationStep; message: string; details?: string }
  | { kind: "done"; result: VaultCreationResult };

/** Creates the vault on Stellar from the wizard's answers. Starts as soon as it opens. */
export default function CreateVaultScreen() {
  const { colors } = useTheme();
  const { state } = useVaultSetup();
  const { setVaultName } = useVaultNames();
  const [phase, setPhase] = useState<Phase>({ kind: "running", step: "fund" });
  // One creation per visit; it holds the setup key in memory until the vault is configured.
  const creation = useRef<VaultCreation | null>(null);
  const started = useRef(false);

  const run = useCallback(async () => {
    const config = configFromState(state);
    const validation = config ? validateVaultConfig(config) : null;
    // Same gate as the review screen: this screen never creates an unconfirmed or invalid vault.
    if (!config || !validation || !reviewGate(validation, state.confirmed).canSubmit) {
      setPhase({ kind: "failed", step: "fund", message: "Go back and review the vault setup." });
      return;
    }
    creation.current ??= startVaultCreation({
      config,
      usdc: getUsdc(network.id),
      network,
      horizon,
    });
    try {
      const result = await creation.current.run((step) => setPhase({ kind: "running", step }));
      await setVaultName(result.accountId, trimmedName(state));
      setPhase({ kind: "done", result });
    } catch (e) {
      const error =
        e instanceof VaultCreationError
          ? e
          : new VaultCreationError("verify", "Something went wrong.", e);
      const codes = error.resultCodes;
      setPhase({
        kind: "failed",
        step: error.step,
        message: error.message,
        ...(codes
          ? { details: [codes.transaction, ...(codes.operations ?? [])].filter(Boolean).join(", ") }
          : {}),
      });
    }
  }, [state, setVaultName]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  const running = phase.kind === "running";
  const currentIndex = STEPS.findIndex(
    (s) => s.step === (phase.kind === "done" ? "verify" : phase.step),
  );

  const close = () => router.dismissAll();
  const openVault = (accountId: string) => {
    router.dismissAll();
    router.push({ pathname: "/vault/[id]", params: { id: accountId } });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: phase.kind === "done" ? "Vault created" : "Creating vault",
          // No going back halfway; the screen offers Close / Try again itself.
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <Text variant="title" accessibilityRole="header">
        {trimmedName(state)}
      </Text>

      <Card>
        {STEPS.map(({ step, label }, i) => {
          const done = phase.kind === "done" || i < currentIndex;
          const active = i === currentIndex && phase.kind !== "done";
          return (
            <View key={step} style={styles.stepRow} accessible accessibilityLabel={label}>
              <View style={styles.stepIcon}>
                {done ? (
                  <Icon icon={CircleCheck} color="success" />
                ) : active && running ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Icon icon={Circle} color={active ? "danger" : "textMuted"} />
                )}
              </View>
              <Text
                variant="body"
                color={done || active ? "text" : "textMuted"}
                style={styles.flex}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </Card>

      {phase.kind === "failed" ? (
        <>
          <Banner tone="danger" title="The vault wasn't created" message={phase.message} />
          {phase.details ? (
            <Text variant="caption" color="textMuted">
              Details: {phase.details}
            </Text>
          ) : null}
          <Button label="Try again" icon={RotateCcw} fullWidth onPress={() => void run()} />
          <Button label="Close" variant="ghost" fullWidth onPress={close} />
        </>
      ) : null}

      {phase.kind === "done" ? (
        <>
          <Banner
            tone="success"
            title="Your vault is ready"
            message="Payments from it now need the approvals you chose. The other signers will see it in Cosignly automatically."
          />
          <Card>
            <Text variant="caption" color="textMuted">
              Vault address
            </Text>
            <AddressChip address={phase.result.accountId} showExplorerLink />
          </Card>
          <Button
            label="Open vault"
            icon={ShieldCheck}
            fullWidth
            onPress={() => openVault(phase.result.accountId)}
          />
          {phase.result.txHash ? (
            <Button
              label="View setup on stellar.expert"
              icon={ExternalLink}
              variant="ghost"
              fullWidth
              onPress={() =>
                void Linking.openURL(explorerTransactionUrl(network, phase.result.txHash ?? ""))
              }
            />
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: screenPadding, gap: space.md, paddingBottom: space.huge },
  stepRow: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 32 },
  stepIcon: { width: 24, alignItems: "center" },
  flex: { flex: 1 },
});
