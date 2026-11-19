import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Appearance, useColorScheme } from "react-native";
import * as SystemUI from "expo-system-ui";

import {
  loadAppearancePreference,
  resolveColorScheme,
  saveAppearancePreference,
  type AppearancePreference,
  type ColorScheme,
} from "./preference";
import { dark, light, type ColorTokens } from "./tokens";

export interface Theme {
  scheme: ColorScheme;
  colors: ColorTokens;
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
  /** `false` until the stored preference has been read (keep the splash up until then). */
  ready: boolean;
}

const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  /** Skip storage and start with this preference (tests, previews). */
  initialPreference?: AppearancePreference;
}

export function ThemeProvider({ children, initialPreference }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<AppearancePreference>(
    initialPreference ?? "system",
  );
  const [ready, setReady] = useState(initialPreference !== undefined);
  const systemScheme = useColorScheme();

  // Read the stored choice once, before the first screen is shown.
  useEffect(() => {
    if (initialPreference !== undefined) return;
    let cancelled = false;
    void loadAppearancePreference().then((stored) => {
      if (cancelled) return;
      setPreferenceState(stored);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [initialPreference]);

  // Apply the override natively so alerts, keyboards and the status bar match.
  useEffect(() => {
    if (!ready) return;
    Appearance.setColorScheme(preference === "system" ? "auto" : preference);
  }, [preference, ready]);

  const scheme = resolveColorScheme(preference, systemScheme);
  const colors = scheme === "dark" ? dark : light;

  // Root view background (visible behind screens during transitions and keyboard).
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    void saveAppearancePreference(next);
  }, []);

  const value = useMemo<Theme>(
    () => ({ scheme, colors, preference, setPreference, ready }),
    [scheme, colors, preference, setPreference, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active theme. Components must take colors from here, never from raw values. */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return theme;
}
