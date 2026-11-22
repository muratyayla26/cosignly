import { Redirect, Stack } from "expo-router";

import { useStackScreenOptions } from "@/lib/stackOptions";
import { useSigner } from "@/signer";
import { VaultSetupProvider } from "@/vaultSetup/VaultSetupProvider";

/** Vault setup wizard: name → signers → rules → review. State lives in memory only. */
export default function VaultSetupLayout() {
  const { state } = useSigner();
  const screenOptions = useStackScreenOptions();
  if (state.status === "none") return <Redirect href="/onboarding" />;
  if (state.status !== "ready") return null;

  return (
    <VaultSetupProvider ownKey={state.publicKey}>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ title: "New vault" }} />
        <Stack.Screen name="signers" options={{ title: "Signers" }} />
        <Stack.Screen name="scan" options={{ title: "Scan address", presentation: "modal" }} />
        <Stack.Screen name="rules" options={{ title: "Approval rules" }} />
        <Stack.Screen name="review" options={{ title: "Review" }} />
        <Stack.Screen
          name="create"
          options={{
            title: "Creating vault",
            headerBackVisible: false,
            gestureEnabled: false,
            fullScreenGestureEnabled: false,
          }}
        />
      </Stack>
    </VaultSetupProvider>
  );
}
