import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAvoidingScreen, Text, useKeyboardOpen } from "@/components";
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
      <Footer>{footer}</Footer>
    </KeyboardAvoidingScreen>
  );
}

/** Sits on the keyboard while it's open; above the home indicator / navigation bar otherwise. */
function Footer({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  return (
    <View
      style={[
        styles.footer,
        {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          paddingBottom: screenPadding + (keyboardOpen ? 0 : insets.bottom),
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: screenPadding, gap: space.md, paddingBottom: space.xl },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: screenPadding,
    paddingHorizontal: screenPadding,
    gap: space.xs,
  },
});
