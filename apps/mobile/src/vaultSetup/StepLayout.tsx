import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KeyboardAvoidingScreen, Text } from "@/components";
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
    <KeyboardAvoidingScreen>
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
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: screenPadding, gap: space.md, paddingBottom: space.xl },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  footerInner: { padding: screenPadding, gap: space.xs },
});
