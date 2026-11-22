import { useState, type ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAvoidingScreen, Text, useKeyboardOpen, useKeyboardOverlap } from "@/components";
import { screenPadding, space, useTheme } from "@/theme";

export const SETUP_STEPS = 4;

/**
 * Where the footer goes while the keyboard is open:
 * - `above`: the footer sits on the keyboard (short steps with one field).
 * - `behind`: the footer stays at the bottom, under the keyboard; only the
 *   content scrolls (steps that already have buttons next to the field).
 */
export type FooterKeyboardMode = "above" | "behind";

/** Common frame for a wizard step: "Step N of 4", content, and a footer with the next button. */
export function StepLayout({
  step,
  title,
  intro,
  children,
  footer,
  footerWithKeyboard = "above",
}: {
  step: number;
  title: string;
  intro?: string;
  children: ReactNode;
  footer: ReactNode;
  footerWithKeyboard?: FooterKeyboardMode;
}) {
  const behind = footerWithKeyboard === "behind";
  return (
    <KeyboardAvoidingScreen avoid={!behind}>
      <StepBody behind={behind} footer={footer}>
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
      </StepBody>
    </KeyboardAvoidingScreen>
  );
}

function StepBody({
  behind,
  footer,
  children,
}: {
  behind: boolean;
  footer: ReactNode;
  children: ReactNode;
}) {
  const overlap = useKeyboardOverlap();
  const [footerHeight, setFooterHeight] = useState(0);
  // Footer stays behind the keyboard: shrink only the ScrollView by the part of
  // it the keyboard covers. Android's ScrollView then keeps the focused field
  // in view by itself. On iOS the ScrollView does both natively
  // (`automaticallyAdjustKeyboardInsets` adds the inset and scrolls to the field).
  const shrink = behind && Platform.OS === "android" ? Math.max(0, overlap - footerHeight) : 0;

  return (
    <>
      <ScrollView
        style={{ marginBottom: shrink }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={behind}
      >
        {children}
      </ScrollView>
      <Footer onHeight={setFooterHeight}>{footer}</Footer>
    </>
  );
}

/** Above the home indicator / navigation bar; drops that inset while it sits on the keyboard. */
function Footer({ children, onHeight }: { children: ReactNode; onHeight: (h: number) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  return (
    <View
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
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
