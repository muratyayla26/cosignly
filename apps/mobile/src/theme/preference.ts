import AsyncStorage from "@react-native-async-storage/async-storage";

/** What the user picked in Settings → Appearance. */
export type AppearancePreference = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

/** Not secret, so AsyncStorage (not secure storage) per docs/design.md §1. */
export const APPEARANCE_STORAGE_KEY = "cosignly.appearance";

const isPreference = (v: unknown): v is AppearancePreference =>
  v === "system" || v === "light" || v === "dark";

export async function loadAppearancePreference(): Promise<AppearancePreference> {
  try {
    const stored = await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export async function saveAppearancePreference(preference: AppearancePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, preference);
  } catch {
    // Not critical: the choice applies for this session and falls back to "system" next launch.
  }
}

/** The scheme to render, given the user's preference and the system scheme. */
export function resolveColorScheme(
  preference: AppearancePreference,
  system: ColorScheme | null | undefined,
): ColorScheme {
  if (preference !== "system") return preference;
  return system === "dark" ? "dark" : "light";
}
