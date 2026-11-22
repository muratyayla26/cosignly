import { Square, SquareCheck } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { minTouchTarget, space, type ColorToken } from "@/theme";

import { Icon } from "./Icon";
import { Text } from "./Text";

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Color of the box when checked (e.g. `warning` for risk confirmations). */
  tone?: ColorToken;
}

/** Explicit yes/no confirmation. The label is the full statement being confirmed. */
export function Checkbox({ label, checked, onChange, tone = "primary" }: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View style={styles.box}>
        <Icon
          icon={checked ? SquareCheck : Square}
          color={checked ? tone : "textMuted"}
          size="md"
        />
      </View>
      <Text variant="callout" style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: minTouchTarget,
  },
  box: { paddingTop: 1 },
  label: { flex: 1 },
});
