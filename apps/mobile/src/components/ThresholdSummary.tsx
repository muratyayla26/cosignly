import { describeThresholds, validateVaultConfig, type VaultConfig } from "@cosignly/shared";
import { Send, TriangleAlert, UsersRound } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { space } from "@/theme";

import { Icon } from "./Icon";
import { Text } from "./Text";

export interface ThresholdSummaryProps {
  config: VaultConfig;
  /** Also list problems with the setup (N-1 rule, active account key, ...). */
  showIssues?: boolean;
}

/** "Payments need 2 of 3 · Changing signers needs 2 of 3", plus warnings. */
export function ThresholdSummary({ config, showIssues = true }: ThresholdSummaryProps) {
  const { payments, admin } = describeThresholds(config);
  const issues = showIssues ? validateVaultConfig(config).issues : [];

  return (
    <View style={styles.list}>
      <Row icon={Send} text={`Payments need ${payments.phrase}`} />
      <Row icon={UsersRound} text={`Changing signers needs ${admin.phrase}`} />
      {issues.map((issue) => {
        const color = issue.severity === "error" ? "danger" : "warning";
        return (
          <View key={issue.code} style={styles.row} accessible accessibilityRole="alert">
            <Icon icon={TriangleAlert} color={color} />
            <Text variant="callout" color={color} style={styles.text}>
              {issue.message}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Row({ icon, text }: { icon: typeof Send; text: string }) {
  return (
    <View style={styles.row}>
      <Icon icon={icon} color="textMuted" />
      <Text variant="body" style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  row: { flexDirection: "row", gap: space.xs, alignItems: "flex-start" },
  text: { flex: 1 },
});
