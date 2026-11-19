import { router } from "expo-router";
import { KeyRound, LifeBuoy, Users, type LucideIcon } from "lucide-react-native";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Icon, Text } from "@/components";
import { brandImages, LOCKUP_STACKED_RATIO } from "@/lib/brand";
import { screenPadding, space, useTheme } from "@/theme";

const POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Users,
    title: "Approve together",
    body: "Money leaves a shared vault only when enough signers approve.",
  },
  {
    icon: KeyRound,
    title: "Your key stays on this phone",
    body: "It is protected by Face ID or your fingerprint and never sent to Cosignly's servers.",
  },
  {
    icon: LifeBuoy,
    title: "Your vaults don't depend on us",
    body: "Vaults live on the Stellar network. Signers can always use other Stellar tools.",
  },
];

/** First launch: what Cosignly is, then create or import a signer key. */
export default function WelcomeScreen() {
  const { colors, scheme } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image
            source={brandImages.lockupStacked[scheme]}
            style={styles.lockup}
            resizeMode="contain"
            accessibilityLabel="Cosignly"
          />
          <Text variant="title" align="center" accessibilityRole="header">
            Shared approvals for Stellar vaults
          </Text>
        </View>

        <View style={styles.points}>
          {POINTS.map((p) => (
            <View key={p.title} style={styles.point}>
              <View style={[styles.pointIcon, { backgroundColor: colors.primaryTint }]}>
                <Icon icon={p.icon} color="primary" />
              </View>
              <View style={styles.pointText}>
                <Text variant="bodyStrong">{p.title}</Text>
                <Text variant="callout" color="textMuted">
                  {p.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            label="Create a signer key"
            fullWidth
            onPress={() =>
              router.push({ pathname: "/onboarding/recovery", params: { next: "create" } })
            }
          />
          <Button
            label="I already have a key"
            variant="secondary"
            fullWidth
            onPress={() =>
              router.push({ pathname: "/onboarding/recovery", params: { next: "import" } })
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, padding: screenPadding, gap: space.xl, justifyContent: "center" },
  hero: { alignItems: "center", gap: space.md },
  lockup: { width: 140, height: 140 / LOCKUP_STACKED_RATIO },
  points: { gap: space.lg },
  point: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pointText: { flex: 1, gap: space.xxs },
  actions: { gap: space.sm },
});
