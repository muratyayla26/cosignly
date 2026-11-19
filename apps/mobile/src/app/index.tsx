import { cryptoSelfCheck } from "@cosignly/shared";
import { Redirect, router } from "expo-router";
import { Globe, Palette, Settings, ShieldAlert, ShieldCheck } from "lucide-react-native";
import { useMemo } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddressChip, Banner, Button, Card, Icon, Text } from "@/components";
import { brandImages, LOCKUP_STACKED_RATIO } from "@/lib/brand";
import { network } from "@/lib/stellar";
import { timeAgo } from "@/lib/time";
import { useNetworkStatus, type NetworkState } from "@/lib/useNetworkStatus";
import { useSigner } from "@/signer";
import { minTouchTarget, screenPadding, space, useTheme } from "@/theme";

export default function HomeScreen() {
  const { colors, scheme } = useTheme();
  const { state, refreshing, refresh } = useNetworkStatus();
  // Runs once per launch: proves secure randomness + Ed25519 work on this device.
  const selfCheck = useMemo(() => cryptoSelfCheck(), []);
  const { state: signer } = useSigner();

  if (signer.status === "none") return <Redirect href="/onboarding" />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={space.xs}
            onPress={() => router.push("/settings")}
            style={styles.iconButton}
          >
            <Icon icon={Settings} color="primary" size="md" />
          </Pressable>
        </View>
        <View style={styles.hero}>
          <Image
            source={brandImages.lockupStacked[scheme]}
            style={styles.lockup}
            resizeMode="contain"
            accessibilityLabel="Cosignly"
          />
          <Text variant="callout" color="textMuted" align="center">
            Shared approvals for Stellar vaults
          </Text>
        </View>

        {signer.status === "ready" ? (
          <Card>
            <Text variant="heading">Your signer key</Text>
            <AddressChip address={signer.publicKey} name="You" />
          </Card>
        ) : null}

        <Card>
          <Text variant="heading">Network</Text>
          <NetworkRow state={state} />
        </Card>

        <Card>
          <Text variant="heading">This device</Text>
          <View style={styles.row}>
            <Icon
              icon={selfCheck.ok ? ShieldCheck : ShieldAlert}
              color={selfCheck.ok ? "success" : "danger"}
            />
            <Text variant="body" color={selfCheck.ok ? "success" : "danger"}>
              {selfCheck.ok ? "Secure signing is available" : "Secure signing is not available"}
            </Text>
          </View>
          {selfCheck.ok ? null : (
            <Text variant="caption" color="textMuted">
              Details: {selfCheck.error}
            </Text>
          )}
        </Card>

        {__DEV__ ? (
          <Button
            label="Design preview"
            icon={Palette}
            variant="secondary"
            fullWidth
            onPress={() => router.push("/design")}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function NetworkRow({ state }: { state: NetworkState }) {
  switch (state.kind) {
    case "loading":
      return (
        <Text variant="body" color="textMuted">
          Connecting to Stellar {network.label}…
        </Text>
      );
    case "offline":
      return (
        <Banner
          tone="warning"
          title={`Can't reach Stellar ${network.label}`}
          message="Check your internet connection and pull down to try again."
        />
      );
    case "wrong-network":
      return (
        <Banner
          tone="danger"
          title="Unexpected network"
          message={`The server is not on Stellar ${network.label}. Cosignly will not use it.`}
        />
      );
    case "online":
      return (
        <View style={styles.networkRows}>
          <View style={styles.row}>
            <Icon icon={Globe} color="success" />
            <Text variant="body" color="success">
              Connected to Stellar {network.label}
            </Text>
          </View>
          <Text variant="caption" color="textMuted">
            Last update from the network {timeAgo(state.status.latestLedgerClosedAt)}
          </Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: screenPadding, gap: space.md },
  topBar: { flexDirection: "row", justifyContent: "flex-end" },
  iconButton: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { alignItems: "center", gap: space.xs, paddingBottom: space.xl },
  lockup: { width: 160, height: 160 / LOCKUP_STACKED_RATIO },
  row: { flexDirection: "row", alignItems: "center", gap: space.xs },
  networkRows: { gap: space.xxs },
});
