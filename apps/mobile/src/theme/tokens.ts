/**
 * Color tokens from docs/design.md §2. This is the ONLY file in the app that may
 * contain raw color values (enforced by ESLint). Components read colors through
 * `useTheme()`. Do not change values without updating docs/design.md.
 */

export const brand = {
  ink: "#0B1020",
  indigo: "#5B5CF0",
  violet: "#8B7CFF",
  mint: "#2BD4A4",
  mintOnLight: "#0F9A76",
  paper: "#F5F7FB",
} as const;

export interface ColorTokens {
  /** Screen background */
  bg: string;
  /** Cards, sheets */
  surface: string;
  /** Grouped rows, inputs */
  surfaceMuted: string;
  /** Dividers, card outlines (decorative) */
  border: string;
  /** Input and control borders */
  borderStrong: string;
  /** Primary text */
  text: string;
  /** Secondary text, labels */
  textMuted: string;
  /** Primary buttons, links, focus, "pending" ring */
  primary: string;
  /** Text on primary */
  onPrimary: string;
  /** Selected states, info banners */
  primaryTint: string;
  /** Approved / executed text */
  success: string;
  /** Approved signer dots, check icons */
  successGraphic: string;
  /** Success badges, banners */
  successTint: string;
  /** Stale, expiring soon, risky config */
  warning: string;
  /** Warning badges, banners */
  warningTint: string;
  /** Failed, destructive actions, invalid config */
  danger: string;
  /** Error badges, banners */
  dangerTint: string;
}

export const light: ColorTokens = {
  bg: "#F5F7FB",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF1F8",
  border: "#DDE1EE",
  borderStrong: "#7A82A8",
  text: "#0B1020",
  textMuted: "#4A5480",
  primary: "#4B4CE0",
  onPrimary: "#FFFFFF",
  primaryTint: "#ECECFD",
  success: "#0B7D60",
  successGraphic: "#0F9A76",
  successTint: "#E3F6F0",
  warning: "#9A5B00",
  warningTint: "#FFF3DC",
  danger: "#C0362C",
  dangerTint: "#FDE8E6",
};

export const dark: ColorTokens = {
  bg: "#0B1020",
  surface: "#141A33",
  surfaceMuted: "#1C2342",
  border: "#2A3463",
  borderStrong: "#6873A6",
  text: "#F5F7FB",
  textMuted: "#A9B1D6",
  primary: "#8B8CFF",
  onPrimary: "#0B1020",
  primaryTint: "#20244F",
  success: "#2BD4A4",
  successGraphic: "#2BD4A4",
  successTint: "#10302B",
  warning: "#F5B544",
  warningTint: "#33280F",
  danger: "#FF7A70",
  dangerTint: "#3A1A1F",
};

/** Shadow color for the single soft shadow allowed in the light theme. */
export const shadowColor = brand.ink;

export type ColorToken = keyof ColorTokens;
