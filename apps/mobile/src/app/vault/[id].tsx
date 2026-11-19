import {
  assetCode,
  explorerAccountUrl,
  explorerTransactionUrl,
  formatAmount,
  xlmReserve,
  type ActivityKind,
  type VaultActivity,
} from "@cosignly/shared";
import * as Linking from "expo-linking";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDot,
  ExternalLink,
  KeyRound,
  Plus,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import {
  AddressChip,
  AmountText,
  Banner,
  Button,
  Card,
  Icon,
  Text,
  ThresholdSummary,
} from "@/components";
import { network } from "@/lib/stellar";
import { timeAgo } from "@/lib/time";
import { useRemoteData } from "@/lib/useRemoteData";
import { useSigner } from "@/signer";
import { minTouchTarget, screenPadding, space, useTheme, type ColorToken } from "@/theme";
import { loadVaultDetail, sortedBalances, vaultTitle, type VaultDetail } from "@/vaults/data";

/** One vault: balances, approval rules, signers and recent history. */
export default function VaultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const load = useCallback((signal: AbortSignal) => loadVaultDetail(id, signal), [id]);
  const detail = useRemoteData(load);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={detail.refreshing}
          onRefresh={() => void detail.refresh()}
          tintColor={colors.primary}
        />
      }
    >
      <Stack.Screen options={{ title: vaultTitle(id) }} />
      <AddressChip address={id} showExplorerLink />

      {detail.state.kind === "loading" ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : null}
      {detail.state.kind === "error" ? (
        <Banner tone="warning" title="Couldn't load this vault" message="Pull down to try again." />
      ) : null}
      {detail.state.kind === "ready" && detail.state.data === null ? (
        <Banner
          tone="warning"
          title="This vault no longer exists"
          message={`The account was not found on Stellar ${network.label}. The test network is reset from time to time, which removes all accounts.`}
        />
      ) : null}
      {detail.state.kind === "ready" && detail.state.data ? (
        <>
          {detail.state.stale ? (
            <Banner
              tone="warning"
              title="Showing saved results"
              message="The latest update failed. Pull down to try again."
            />
          ) : null}
          <VaultBody data={detail.state.data} />
          <Text variant="caption" color="textMuted" align="center">
            Updated {timeAgo(detail.state.updatedAt)}
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

function VaultBody({ data }: { data: VaultDetail }) {
  const { state: signer } = useSigner();
  const me = signer.status === "ready" ? signer.publicKey : null;
  const { vault, account, activity } = data;
  const reserve = xlmReserve(account);
  const equalWeights = vault.signers.every((s) => s.weight === vault.signers[0]?.weight);

  return (
    <>
      <Section title="Balances">
        <Card>
          {sortedBalances(account.balances).map((b) => (
            <View key={assetCode(b.asset)} style={styles.between}>
              <Text variant="body" color="textMuted">
                {assetCode(b.asset)}
              </Text>
              <AmountText amount={b.balance} assetCode={assetCode(b.asset)} />
            </View>
          ))}
          <Text variant="caption" color="textMuted">
            The network keeps {formatAmount(reserve.minimumBalance)} XLM in reserve for this
            vault&apos;s signers and assets. Available to send: {formatAmount(reserve.available)}{" "}
            XLM.
          </Text>
        </Card>
      </Section>

      <Section title="Approval rules">
        <Card>
          <ThresholdSummary config={vault} />
        </Card>
      </Section>

      <Section title={`Signers (${vault.signers.length})`}>
        <Card>
          {vault.signers.map((s) => (
            <View key={s.key} style={styles.signerRow}>
              <AddressChip address={s.key} {...(s.key === me ? { name: "You" } : {})} />
              {equalWeights ? null : (
                <Text variant="caption" color="textMuted" tabular>
                  Weight {s.weight}
                </Text>
              )}
            </View>
          ))}
          {account.otherSigners.length > 0 ? (
            <Text variant="caption" color="warning">
              This vault also has {account.otherSigners.length} special signer
              {account.otherSigners.length === 1 ? "" : "s"} that Cosignly can't show.
            </Text>
          ) : null}
        </Card>
      </Section>

      <Section title="Recent activity">
        <Card>
          {activity.length === 0 ? (
            <Text variant="body" color="textMuted">
              No activity yet.
            </Text>
          ) : (
            activity.map((a) => <ActivityRow key={a.id} item={a} me={me} />)
          )}
        </Card>
      </Section>

      <Button
        label="View on stellar.expert"
        icon={ExternalLink}
        variant="secondary"
        fullWidth
        onPress={() => void Linking.openURL(explorerAccountUrl(network, account.id))}
      />
    </>
  );
}

const activityIcon: Record<ActivityKind, { icon: LucideIcon; color: ColorToken }> = {
  received: { icon: ArrowDownLeft, color: "success" },
  sent: { icon: ArrowUpRight, color: "text" },
  created: { icon: Plus, color: "primary" },
  "asset-added": { icon: Plus, color: "primary" },
  "asset-removed": { icon: CircleDot, color: "textMuted" },
  "signers-changed": { icon: KeyRound, color: "primary" },
  "rules-changed": { icon: ShieldCheck, color: "primary" },
  merged: { icon: ArrowUpRight, color: "warning" },
  other: { icon: CircleDot, color: "warning" },
};

function ActivityRow({ item, me }: { item: VaultActivity; me: string | null }) {
  const { icon, color } = activityIcon[item.kind];
  const who =
    item.counterparty === undefined
      ? null
      : item.counterparty === me
        ? "You"
        : `${item.counterparty.slice(0, 4)}…${item.counterparty.slice(-4)}`;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${item.title}${who ? `, ${who}` : ""}, ${timeAgo(item.createdAt)}`}
      accessibilityHint="Opens the transaction on stellar.expert"
      onPress={() => void Linking.openURL(explorerTransactionUrl(network, item.transactionHash))}
      style={({ pressed }) => [styles.activityRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon icon={icon} color={color} />
      <View style={styles.activityText}>
        <Text variant="body">{item.title}</Text>
        <Text variant="caption" color="textMuted">
          {[who, timeAgo(item.createdAt)].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Icon icon={ExternalLink} color="textMuted" />
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="caption" color="textMuted" accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: screenPadding, gap: space.xl, paddingBottom: space.huge },
  loading: { paddingVertical: space.xl },
  section: { gap: space.xs },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  signerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.xs,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: minTouchTarget,
  },
  activityText: { flex: 1, gap: 2 },
});
