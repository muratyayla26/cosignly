import type { ImageSourcePropType } from "react-native";

import type { ColorScheme } from "@/theme";

// Brand files live at the repo root (assets/brand); use the variant made for the active background.
const lockupStacked: Record<ColorScheme, ImageSourcePropType> = {
  light: require("../../../../assets/brand/lockup-stacked-on-light.png"),
  dark: require("../../../../assets/brand/lockup-stacked-on-dark.png"),
};

const lockupHorizontal: Record<ColorScheme, ImageSourcePropType> = {
  light: require("../../../../assets/brand/lockup-horizontal-on-light.png"),
  dark: require("../../../../assets/brand/lockup-horizontal-on-dark.png"),
};

export const brandImages = { lockupStacked, lockupHorizontal } as const;

/** Intrinsic aspect ratio of the stacked lockup (661 × 480). */
export const LOCKUP_STACKED_RATIO = 661 / 480;

/** Intrinsic aspect ratio of the horizontal lockup (846 × 240). */
export const LOCKUP_HORIZONTAL_RATIO = 846 / 240;
