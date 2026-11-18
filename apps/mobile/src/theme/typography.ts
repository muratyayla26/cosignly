import type { TextStyle } from "react-native";

/**
 * Inter font family names as registered by `useFonts` in the root layout.
 * Each weight is its own family; never combine with `fontWeight` (Android
 * would synthesize a different weight).
 */
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

export type TextVariant =
  "display" | "title" | "heading" | "body" | "bodyStrong" | "callout" | "caption" | "amountLarge";

/** Type scale from docs/design.md §3. */
export const typography: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  callout: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  amountLarge: {
    fontFamily: fonts.semibold,
    fontSize: 40,
    lineHeight: 46,
    fontVariant: ["tabular-nums"],
  },
};

/** Monospace face for Stellar addresses (system font; Inter has no mono cut). */
export const monoFontFamily = { ios: "Menlo", android: "monospace", default: "monospace" } as const;
