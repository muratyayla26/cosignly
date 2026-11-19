import { assetCode, describeThresholds, type Balance, type Vault } from "@cosignly/shared";
import { ChevronRight, Vault as VaultIcon } from "lucide-react-native";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { monoFontFamily, space, useTheme } from "@/theme";

import { AmountText } from "./AmountText";
import { Card } from "./Card";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface VaultCardProps {
  title: string;
  vault: Vault;
  /** In display order. */
  balances: readonly Balance[];
  onPress: () => void;
}

/** A vault in the list: name, balances and the approval rule. */
export function VaultCard({ title, vault, balances, onPress }: VaultCardProps) {
  const { colors } = useTheme();
  const { payments } = describeThresholds(vault);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. Payments need ${payments.phrase}.`}
      accessibilityHint="Opens the vault"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <Card elevated>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: colors.primaryTint }]}>
            <Icon icon={VaultIcon} color="primary" />
          </View>
          <View style={styles.title}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {title}
            </Text>
            <Text
              variant="caption"
              color="textMuted"
              style={{ fontFamily: Platform.select(monoFontFamily) }}
              numberOfLines={1}
            >
              {vault.accountId.slice(0, 8)}…{vault.accountId.slice(-8)}
            </Text>
          </View>
          <Icon icon={ChevronRight} color="textMuted" />
        </View>
        <View style={styles.balances}>
          {balances.map((b) => (
            <AmountText
              key={assetCode(b.asset)}
              amount={b.balance}
              assetCode={assetCode(b.asset)}
            />
          ))}
        </View>
        <Text variant="callout" color="textMuted">
          Payments need {payments.phrase}
        </Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.sm },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, gap: 2 },
  balances: { gap: space.xxs },
});
