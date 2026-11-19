import QRCode from "qrcode";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { radius, space } from "@/theme";
import { light } from "@/theme/tokens";

export interface QrCodeProps {
  value: string;
  /** Width and height of the code itself, in points. */
  size?: number;
  accessibilityLabel: string;
}

/**
 * A QR code drawn with SVG. Always dark modules on a light plate, in both
 * themes, because some scanners cannot read inverted (light-on-dark) codes.
 */
export function QrCode({ value, size = 200, accessibilityLabel }: QrCodeProps) {
  const { path, count } = useMemo(() => qrPath(value), [value]);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.plate, { backgroundColor: light.surface }]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`} testID="qr-code">
        <Path d={path} fill={light.text} />
      </Svg>
    </View>
  );
}

/** One 1×1 square per dark module, as a single SVG path. */
export function qrPath(value: string): { path: string; count: number } {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  const count = modules.size;
  let path = "";
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (modules.get(x, y)) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { path, count };
}

const styles = StyleSheet.create({
  // The quiet zone around the code must stay light for scanners.
  plate: { padding: space.md, borderRadius: radius.md, alignSelf: "center" },
});
