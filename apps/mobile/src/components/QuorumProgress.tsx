import { StyleSheet, View } from "react-native";

import { space, useTheme } from "@/theme";

import { Text } from "./Text";

export interface QuorumProgressProps {
  approvals: number;
  required: number;
  size?: "sm" | "md";
  /** Hide the "1 of 2 approvals" label (e.g. when shown elsewhere). */
  hideLabel?: boolean;
}

const dotSize = { sm: 10, md: 14 } as const;

/**
 * The logo idea as UI: one dot per required approval. Approved dots are filled
 * mint (`successGraphic`); pending ones are a `primary` ring.
 */
export function QuorumProgress({
  approvals,
  required,
  size = "md",
  hideLabel = false,
}: QuorumProgressProps) {
  const { colors } = useTheme();
  const total = Math.max(required, 0);
  const done = Math.min(Math.max(approvals, 0), total);
  const label = `${done} of ${total} approvals`;
  const d = dotSize[size];

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: done }}
      style={styles.row}
    >
      <View style={styles.dots}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            testID={i < done ? "quorum-dot-approved" : "quorum-dot-pending"}
            style={{
              width: d,
              height: d,
              borderRadius: d / 2,
              borderWidth: 2,
              borderColor: i < done ? colors.successGraphic : colors.primary,
              backgroundColor: i < done ? colors.successGraphic : "transparent",
            }}
          />
        ))}
      </View>
      {hideLabel ? null : (
        <Text variant="caption" color="textMuted" tabular>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.xs },
  dots: { flexDirection: "row", gap: space.xxs },
});
