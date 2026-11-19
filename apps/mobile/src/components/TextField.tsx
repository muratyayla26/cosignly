import { useState } from "react";
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { minTouchTarget, monoFontFamily, radius, space, typography, useTheme } from "@/theme";

import { Text } from "./Text";

export interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  /** Error shown under the field; also marks the field invalid for screen readers. */
  error?: string | null;
  hint?: string;
  /** Use the monospace font (addresses, keys). */
  mono?: boolean;
}

export function TextField({
  label,
  error,
  hint,
  mono = false,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.borderStrong;

  return (
    <View style={styles.wrapper}>
      <Text variant="callout" color="textMuted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        {...(error ? { accessibilityHint: error } : hint ? { accessibilityHint: hint } : {})}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        maxFontSizeMultiplier={2}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
        style={[
          styles.input,
          typography.body,
          mono && { fontFamily: Platform.select(monoFontFamily) },
          {
            color: colors.text,
            // Inputs sit on `surface`: borderStrong meets 3:1 there in both themes.
            backgroundColor: colors.surface,
            borderColor,
            borderWidth: focused || error ? 2 : 1,
          },
        ]}
      />
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.xxs },
  input: {
    minHeight: minTouchTarget + 4,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
});
