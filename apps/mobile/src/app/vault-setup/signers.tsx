import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { ArrowRight, ClipboardPaste, Plus, ScanLine, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AddressChip, Button, Card, Icon, Text, TextField } from "@/components";
import { minTouchTarget, space } from "@/theme";
import { checkNewSigner, MIN_VAULT_SIGNERS } from "@/vaultSetup/state";
import { StepLayout } from "@/vaultSetup/StepLayout";
import { useVaultSetup } from "@/vaultSetup/VaultSetupProvider";

/** Step 2: who can approve. This phone's key is always on the list. */
export default function SignersStep() {
  const { state, dispatch } = useVaultSetup();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ownKey, ...others] = state.signers;
  const needed = MIN_VAULT_SIGNERS - state.signers.length;

  const add = (value: string) => {
    const result = checkNewSigner(value, state.signers);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    dispatch({ type: "addSigner", key: result.address });
    setInput("");
    setError(null);
  };

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    setInput(text.trim());
    add(text);
  };

  return (
    <StepLayout
      step={2}
      title="Add signers"
      intro="Signers are the people who approve payments from this vault. Ask each one for their Cosignly address (Settings → Your signer key) or any Stellar address they control."
      footer={
        <>
          {needed > 0 ? (
            <Text variant="caption" color="textMuted" align="center">
              Add at least {needed} more signer{needed === 1 ? "" : "s"} to continue.
            </Text>
          ) : null}
          <Button
            label="Next"
            icon={ArrowRight}
            fullWidth
            disabled={needed > 0}
            onPress={() => router.push("/vault-setup/rules")}
          />
        </>
      }
    >
      <Card>
        <Text variant="bodyStrong">
          {state.signers.length} signer{state.signers.length === 1 ? "" : "s"}
        </Text>
        {ownKey ? <AddressChip address={ownKey} name="You" /> : null}
        {others.map((key, i) => (
          <View key={key} style={styles.row}>
            <View style={styles.flex}>
              <AddressChip address={key} name={`Signer ${i + 2}`} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove signer ${i + 2}`}
              onPress={() => dispatch({ type: "removeSigner", key })}
              style={styles.remove}
            >
              <Icon icon={X} color="textMuted" />
            </Pressable>
          </View>
        ))}
      </Card>

      <TextField
        label="Signer address"
        value={input}
        onChangeText={(t) => {
          setInput(t);
          setError(null);
        }}
        placeholder="G…"
        error={error}
        mono
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        returnKeyType="done"
        onSubmitEditing={() => add(input)}
      />
      <View style={styles.actions}>
        <Button label="Add" icon={Plus} variant="secondary" onPress={() => add(input)} />
        <Button label="Paste" icon={ClipboardPaste} variant="ghost" onPress={() => void paste()} />
        <Button
          label="Scan QR"
          icon={ScanLine}
          variant="ghost"
          onPress={() => router.push("/vault-setup/scan")}
        />
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.xs },
  flex: { flex: 1 },
  remove: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
