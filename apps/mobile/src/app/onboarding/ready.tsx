import { router } from "expo-router";
import { CircleCheck } from "lucide-react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddressChip, Button, Icon, QrCode, Text } from "@/components";
import { useSigner } from "@/signer";
import { screenPadding, space, useTheme } from "@/theme";

/** Shown once after the key is created or imported. */
export default function KeyReadyScreen() {
  const { colors } = useTheme();
  const { state } = useSigner();
  if (state.status !== "ready") return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: colors.successTint }]}>
            <Icon icon={CircleCheck} color="success" size="md" />
          </View>
          <Text variant="title" align="center" accessibilityRole="header">
            Your signer key is ready
          </Text>
          <Text variant="body" color="textMuted" align="center">
            This is your public address. Share it with whoever sets up your vault so they can add
            you as a signer. It is safe to share.
          </Text>
        </View>

        <QrCode value={state.publicKey} accessibilityLabel="QR code of your public address" />
        <View style={styles.center}>
          <AddressChip address={state.publicKey} name="You" />
        </View>

        <Button label="Continue" fullWidth onPress={() => router.replace("/")} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, padding: screenPadding, gap: space.xl, justifyContent: "center" },
  header: { alignItems: "center", gap: space.sm },
  center: { alignItems: "center" },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
