import {
  CircleCheck,
  CircleX,
  Clock,
  Hourglass,
  RefreshCcw,
  SendHorizontal,
  type LucideIcon,
} from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { radius, space, useTheme, type ColorToken } from "@/theme";

import { Icon } from "./Icon";
import { Text } from "./Text";

/** User-facing proposal states (docs/design.md §6). */
export type ProposalBadgeStatus = "pending" | "ready" | "executed" | "expired" | "stale" | "failed";

const statusStyle: Record<
  ProposalBadgeStatus,
  { label: string; icon: LucideIcon; fg: ColorToken; bg: ColorToken }
> = {
  pending: { label: "Pending", icon: Clock, fg: "primary", bg: "primaryTint" },
  ready: { label: "Ready", icon: SendHorizontal, fg: "success", bg: "successTint" },
  executed: { label: "Executed", icon: CircleCheck, fg: "success", bg: "successTint" },
  expired: { label: "Expired", icon: Hourglass, fg: "textMuted", bg: "surfaceMuted" },
  stale: { label: "Outdated", icon: RefreshCcw, fg: "warning", bg: "warningTint" },
  failed: { label: "Failed", icon: CircleX, fg: "danger", bg: "dangerTint" },
};

export function StatusBadge({ status }: { status: ProposalBadgeStatus }) {
  const { colors } = useTheme();
  const s = statusStyle[status];
  return (
    <View
      accessible
      accessibilityLabel={`Status: ${s.label}`}
      style={[styles.badge, { backgroundColor: colors[s.bg] }]}
    >
      <Icon icon={s.icon} color={s.fg} />
      <Text variant="caption" color={s.fg}>
        {s.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.xxs,
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
    borderRadius: radius.sm,
  },
});
