import { parseProposalLink } from "@cosignly/shared";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { ArrowRight, ClipboardPaste } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { Button, KeyboardAvoidingScreen, Text, TextField } from "@/components";
import { screenPadding, space } from "@/theme";

/**
 * Open a proposal from a link someone shared (Cosignly or Refractor link, or
 * the bare hash). Until push notifications arrive in Week 3, this is how
 * co-signers on other phones reach a proposal.
 */
export default function OpenProposalScreen() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = (value: string) => {
    const hash = parseProposalLink(value);
    if (!hash) {
      setError("This isn't a Cosignly or Refractor proposal link.");
      return;
    }
    setError(null);
    router.replace({ pathname: "/proposal/[hash]", params: { hash } });
  };

  const paste = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    setInput(text);
    open(text);
  };

  return (
    <KeyboardAvoidingScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text variant="body" color="textMuted">
          Paste the link a co-signer shared with you. It starts with cosignly://proposal/ or
          https://refractor.space/tx/.
        </Text>
        <TextField
          label="Proposal link"
          value={input}
          onChangeText={(t) => {
            setInput(t);
            setError(null);
          }}
          placeholder="cosignly://proposal/…"
          error={error}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          returnKeyType="go"
          onSubmitEditing={() => open(input)}
        />
        <Button label="Paste" icon={ClipboardPaste} variant="ghost" onPress={() => void paste()} />
        <Button label="Open" icon={ArrowRight} fullWidth onPress={() => open(input)} />
      </ScrollView>
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: screenPadding, gap: space.md, paddingBottom: space.huge },
});
