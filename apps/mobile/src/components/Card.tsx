import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { shadowColor } from "@/theme/tokens";
import { radius, space, useTheme } from "@/theme";

export interface CardProps {
  children: ReactNode;
  /** Floating card: soft shadow in light theme, border only in dark theme. */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, elevated = false, style }: CardProps) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        elevated && scheme === "light" && styles.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: space.sm,
  },
  shadow: {
    shadowColor,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
