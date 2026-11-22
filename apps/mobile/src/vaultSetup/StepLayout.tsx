import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components";
import { screenPadding, space, useTheme } from "@/theme";

export const SETUP_STEPS = 4;

/** Common frame for a wizard step: "Step N of 4", content, and a footer with the next button. */
export function StepLayout({
  step,
  title,
  intro,
  children,
  footer,
}: {
  step: number;
  title: string;
  intro?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="caption" color="textMuted">
          Step {step} of {SETUP_STEPS}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {intro ? (
          <Text variant="body" color="textMuted">
            {intro}
          </Text>
        ) : null}
        {children}
      </ScrollView>
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.footer, { backgroundColor: colors.bg, borderTopColor: colors.border }]}
      >
        <View style={styles.footerInner}>{footer}</View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: screenPadding, gap: space.md, paddingBottom: space.xl },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  footerInner: { padding: screenPadding, gap: space.xs },
});
