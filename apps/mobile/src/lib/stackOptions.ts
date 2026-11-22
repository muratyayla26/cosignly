import type { NativeStackNavigationOptions } from "expo-router";

import { fonts, useTheme } from "@/theme";

/** Header style shared by the root stack and nested stacks (e.g. the vault setup wizard). */
export function useStackScreenOptions(): NativeStackNavigationOptions {
  const { colors } = useTheme();
  return {
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.primary,
    headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
    headerShadowVisible: false,
    // Back button shows only the chevron, never the previous screen's title.
    headerBackButtonDisplayMode: "minimal",
    contentStyle: { backgroundColor: colors.bg },
  };
}
