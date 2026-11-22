import { Minus, Plus, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { minTouchTarget, radius, space, useTheme } from "@/theme";

import { Icon } from "./Icon";
import { Text } from "./Text";

export interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Optional text after the number, e.g. "of 3". */
  suffix?: string;
}

/** Small whole-number control (weights, thresholds) with − / + buttons. */
export function Stepper({ label, value, min, max, onChange, suffix }: StepperProps) {
  const { colors } = useTheme();
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{
        min,
        max,
        now: value,
        text: suffix ? `${value} ${suffix}` : `${value}`,
      }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) =>
        set(value + (e.nativeEvent.actionName === "increment" ? 1 : -1))
      }
      style={styles.row}
    >
      <Text variant="body" style={styles.label}>
        {label}
      </Text>
      <View style={[styles.control, { borderColor: colors.borderStrong }]}>
        <StepButton
          icon={Minus}
          label={`Decrease ${label}`}
          disabled={value <= min}
          onPress={() => set(value - 1)}
        />
        <Text variant="bodyStrong" tabular style={styles.value}>
          {suffix ? `${value} ${suffix}` : value}
        </Text>
        <StepButton
          icon={Plus}
          label={`Increase ${label}`}
          disabled={value >= max}
          onPress={() => set(value + 1)}
        />
      </View>
    </View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Icon icon={icon} color="primary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  label: { flex: 1 },
  control: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.md,
  },
  button: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { minWidth: 48, textAlign: "center" },
});
