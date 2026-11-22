import { cryptoSelfCheck } from "@cosignly/shared";
import { Redirect, router, useFocusEffect } from "expo-router";
import { Palette, Plus, QrCode as QrCodeIcon, Settings } from "lucide-react-native";
import { useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Banner, Button, Card, Icon, Text, VaultCard } from "@/components";
import { brandImages, LOCKUP_HORIZONTAL_RATIO } from "@/lib/brand";
import { network } from "@/lib/stellar";
import { timeAgo } from "@/lib/time";
import { useNetworkStatus } from "@/lib/useNetworkStatus";
import { useRemoteData } from "@/lib/useRemoteData";
import { useSigner } from "@/signer";
import { minTouchTarget, screenPadding, space, useTheme } from "@/theme";
import { loadVaults, sortedBalances, vaultTitle } from "@/vaults/data";
import { useVaultNames } from "@/vaults/names";

/** Home: the vaults this phone's signer key can approve for. */
export default function HomeScreen() {
  const { state: signer } = useSigner();
  if (signer.status === "none") return <Redirect href="/onboarding" />;
  if (signer.status !== "ready") return null;
  return <VaultList publicKey={signer.publicKey} />;
}

function VaultList({ publicKey }: { publicKey: string }) {
  const { colors, scheme } = useTheme();
  const net = useNetworkStatus();
  const load = useCallback((signal: AbortSignal) => loadVaults(publicKey, signal), [publicKey]);
  const vaults = useRemoteData(load);
  const { names } = useVaultNames();
  // Reload when coming back to Home (e.g. after creating a vault); the first focus is the initial load.
  const focused = useRef(false);
  const { reload } = vaults;
  useFocusEffect(
    useCallback(() => {
      if (focused.current) void reload();
      focused.current = true;
    }, [reload]),
  );
  // Runs once per launch: proves secure randomness + Ed25519 work on this device.
  const selfCheck = useMemo(() => cryptoSelfCheck(), []);

  const onRefresh = () => {
    void net.refresh();
    void vaults.refresh();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={vaults.refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.topBar}>
          <Image
            source={brandImages.lockupHorizontal[scheme]}
            style={styles.lockup}
            resizeMode="contain"
            accessibilityLabel="Cosignly"
          />
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

        {net.state.kind === "offline" ? (
          <Banner
            tone="warning"
            title={`Can't reach Stellar ${network.label}`}
            message="Check your internet connection and pull down to try again."
          />
        ) : null}
        {net.state.kind === "wrong-network" ? (
          <Banner
            tone="danger"
            title="Unexpected network"
            message={`The server is not on Stellar ${network.label}. Cosignly will not use it.`}
          />
        ) : null}
        {selfCheck.ok ? null : (
          <Banner
            tone="danger"
            title="Secure signing is not available on this phone"
            message={`Details: ${selfCheck.error ?? "unknown"}`}
          />
        )}

        <Text variant="title" accessibilityRole="header">
          Your vaults
        </Text>

        {vaults.state.kind === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text variant="callout" color="textMuted">
              Looking for vaults on Stellar {network.label}…
            </Text>
          </View>
        ) : null}

        {vaults.state.kind === "error" ? (
          <Banner
            tone="warning"
            title="Couldn't load your vaults"
            message="Pull down to try again."
          />
        ) : null}

        {vaults.state.kind === "ready" ? (
          <>
            {vaults.state.stale ? (
              <Banner
                tone="warning"
                title="Showing saved results"
                message="The latest update failed. Pull down to try again."
              />
            ) : null}
            {vaults.state.data.length === 0 ? (
              <EmptyState />
            ) : (
              vaults.state.data.map(({ vault, account }) => (
                <VaultCard
                  key={vault.accountId}
                  title={vaultTitle(vault.accountId, names)}
                  vault={vault}
                  balances={sortedBalances(account.balances)}
                  onPress={() =>
                    router.push({ pathname: "/vault/[id]", params: { id: vault.accountId } })
                  }
                />
              ))
            )}
            {vaults.state.data.length > 0 ? (
              <Button
                label="Create a vault"
                icon={Plus}
                variant="secondary"
                fullWidth
                onPress={() => router.push("/vault-setup")}
              />
            ) : null}
            <Text variant="caption" color="textMuted" align="center">
              Stellar {network.label} · updated {timeAgo(vaults.state.updatedAt)}
            </Text>
          </>
        ) : null}

        {__DEV__ ? (
          <Button
            label="Design preview"
            icon={Palette}
            variant="ghost"
            onPress={() => router.push("/design")}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyState() {
  return (
    <Card>
      <Text variant="heading">No vaults yet</Text>
      <Text variant="body" color="textMuted">
        Create a vault with your team, or share your address so someone can add you to theirs.
        Vaults you sign for show up here automatically.
      </Text>
      <Button
        label="Create a vault"
        icon={Plus}
        fullWidth
        onPress={() => router.push("/vault-setup")}
      />
      <Button
        label="Show my address"
        icon={QrCodeIcon}
        variant="secondary"
        fullWidth
        onPress={() => router.push("/settings")}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: screenPadding, gap: space.md, paddingBottom: space.huge },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lockup: { width: 132, height: 132 / LOCKUP_HORIZONTAL_RATIO },
  iconButton: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { alignItems: "center", gap: space.xs, paddingVertical: space.xl },
});
