import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { typography, useTheme, type ColorToken, type TextVariant } from "@/theme";

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: ColorToken;
  /** Line digits up (amounts, counts). */
  tabular?: boolean;
  align?: "left" | "center" | "right";
}

/** Themed text using the Inter type scale. Scales with the system font size. */
export function Text({
  variant = "body",
  color = "text",
  tabular = false,
  align,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={2}
      {...rest}
      style={[
        typography[variant],
        { color: colors[color] },
        tabular && { fontVariant: ["tabular-nums"] },
        align && { textAlign: align },
        style,
      ]}
    />
  );
}
