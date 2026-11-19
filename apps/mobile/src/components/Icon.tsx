import type { LucideIcon } from "lucide-react-native";

import { iconSize, iconStrokeWidth, useTheme, type ColorToken } from "@/theme";

export interface IconProps {
  icon: LucideIcon;
  color?: ColorToken;
  size?: keyof typeof iconSize;
}

/** Lucide icon with the design system's stroke width, size and a theme color. */
export function Icon({ icon: LucideComponent, color = "text", size = "sm" }: IconProps) {
  const { colors } = useTheme();
  return (
    <LucideComponent
      color={colors[color]}
      size={iconSize[size]}
      strokeWidth={iconStrokeWidth}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
