import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { minTouchTarget, radius, space, useTheme, type ColorToken } from "@/theme";

import { Icon } from "./Icon";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  /** Stretch to the container width. */
  fullWidth?: boolean;
  accessibilityHint?: string;
}

const variantStyle: Record<
  ButtonVariant,
  { bg: ColorToken | null; fg: ColorToken; border: ColorToken | null }
> = {
  primary: { bg: "primary", fg: "onPrimary", border: null },
  secondary: { bg: "surface", fg: "primary", border: "borderStrong" },
  ghost: { bg: null, fg: "primary", border: null },
  danger: { bg: "dangerTint", fg: "danger", border: "danger" },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const v = variantStyle[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: v.bg ? colors[v.bg] : "transparent",
          borderColor: v.border ? colors[v.border] : "transparent",
          opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors[v.fg]} />
        ) : (
          icon && <Icon icon={icon} color={v.fg} />
        )}
        <Text variant="bodyStrong" color={v.fg}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: Math.max(minTouchTarget, 48),
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  fullWidth: { alignSelf: "stretch" },
  content: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
