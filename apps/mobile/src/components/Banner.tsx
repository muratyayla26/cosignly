import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { radius, space, useTheme, type ColorToken } from "@/theme";

import { Icon } from "./Icon";
import { Text } from "./Text";

export type BannerTone = "info" | "success" | "warning" | "danger";

const toneStyle: Record<BannerTone, { fg: ColorToken; bg: ColorToken; icon: LucideIcon }> = {
  info: { fg: "primary", bg: "primaryTint", icon: Info },
  success: { fg: "success", bg: "successTint", icon: CircleCheck },
  warning: { fg: "warning", bg: "warningTint", icon: TriangleAlert },
  danger: { fg: "danger", bg: "dangerTint", icon: CircleAlert },
};

export interface BannerProps {
  tone: BannerTone;
  title: string;
  message?: string;
}

/** Inline message. Meaning is carried by icon + title, never by color alone. */
export function Banner({ tone, title, message }: BannerProps) {
  const { colors } = useTheme();
  const t = toneStyle[tone];
  return (
    <View
      accessible
      accessibilityRole={tone === "danger" || tone === "warning" ? "alert" : "summary"}
      style={[styles.banner, { backgroundColor: colors[t.bg] }]}
    >
      <Icon icon={t.icon} color={t.fg} />
      <View style={styles.text}>
        <Text variant="bodyStrong" color={t.fg}>
          {title}
        </Text>
        {message ? (
          <Text variant="callout" color="text">
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
  text: { flex: 1, gap: space.xxs },
});
