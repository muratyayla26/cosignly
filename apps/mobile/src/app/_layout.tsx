// Import each weight by path so only these four font files are bundled.
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { SignerProvider, useSigner } from "@/signer";
import { fonts, ThemeProvider, useTheme } from "@/theme";

// Keep the native splash up until fonts, the stored theme choice and the signer
// state are ready (no flash, no glimpse of the wrong first screen).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SignerProvider>
        <RootStack />
      </SignerProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { colors, scheme, ready } = useTheme();
  const { state: signer } = useSigner();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // A font error should not block the app; system font is the fallback.
  const loaded = ready && signer.status !== "loading" && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
          headerShadowVisible: false,
          // Back button shows only the chevron, never the previous screen's title.
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Cosignly", headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="design" options={{ title: "Design preview" }} />
        <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/recovery" options={{ title: "" }} />
        <Stack.Screen name="onboarding/import" options={{ title: "Use an existing key" }} />
        <Stack.Screen
          name="onboarding/ready"
          options={{ headerShown: false, gestureEnabled: false }}
        />
      </Stack>
    </>
  );
}
