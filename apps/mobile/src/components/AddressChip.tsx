import { getNetworkConfig, explorerAccountUrl, truncateAddress } from "@cosignly/shared";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Check, Copy, ExternalLink } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { minTouchTarget, monoFontFamily, radius, space, useTheme } from "@/theme";

import { Icon } from "./Icon";
import { Text } from "./Text";

export interface AddressChipProps {
  /** Stellar account address (`G...`). */
  address: string;
  /** Optional contact or vault name shown before the address. */
  name?: string;
  /** Show a stellar.expert link button. */
  showExplorerLink?: boolean;
  /** Called when the chip itself is tapped (e.g. to show the full address). */
  onPress?: () => void;
}

/** Truncated monospace address with copy and optional explorer link. */
export function AddressChip({
  address,
  name,
  showExplorerLink = false,
  onPress,
}: AddressChipProps) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
  };

  const short = truncateAddress(address);

  return (
    <View style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}>
      <Pressable
        accessibilityRole={onPress ? "button" : "text"}
        accessibilityLabel={name ? `${name}, address ${short}` : `Address ${short}`}
        disabled={!onPress}
        onPress={onPress}
        style={styles.label}
      >
        {name ? (
          <Text variant="callout" numberOfLines={1}>
            {name}
          </Text>
        ) : null}
        <Text
          variant="callout"
          color={name ? "textMuted" : "text"}
          style={{ fontFamily: Platform.select(monoFontFamily) }}
        >
          {short}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? "Address copied" : "Copy address"}
        hitSlop={space.xs}
        onPress={copy}
        style={styles.action}
      >
        <Icon icon={copied ? Check : Copy} color={copied ? "success" : "primary"} />
      </Pressable>
      {showExplorerLink ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="View on stellar.expert"
          hitSlop={space.xs}
          onPress={() => void Linking.openURL(explorerAccountUrl(getNetworkConfig(), address))}
          style={styles.action}
        >
          <Icon icon={ExternalLink} color="primary" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingLeft: space.sm,
    minHeight: minTouchTarget,
  },
  label: { flexDirection: "row", alignItems: "center", gap: space.xs, flexShrink: 1 },
  action: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
