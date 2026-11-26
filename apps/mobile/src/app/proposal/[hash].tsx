import {
  addSignatureToEnvelope,
  decodeTransaction,
  explorerTransactionUrl,
  formatAmount,
  proposalShareMessage,
  refractorTxUrl,
  reviewProposal,
  toVault,
  truncateAddress,
  type AccountInfo,
  type CoordinatorStatus,
  type DecodedTransaction,
  type ProposalReview,
} from "@cosignly/shared";
import * as Linking from "expo-linking";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  ExternalLink,
  Fingerprint,
  Send,
  Share2,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";

import {
  AddressChip,
  Banner,
  Button,
  Card,
  Checkbox,
  Icon,
  QuorumProgress,
  Text,
} from "@/components";
import { coordinator, network, usdc } from "@/lib/stellar";
import { useRemoteData } from "@/lib/useRemoteData";
import { loadProposal } from "@/proposals/load";
import { biometricName, SignerErrorBanner, SignerKeyError, useSigner } from "@/signer";
import { monoFontFamily, screenPadding, space, useTheme } from "@/theme";
import { useVaultNames, vaultTitle } from "@/vaults/names";

/** While a proposal is open, check for new approvals this often. */
const POLL_MS = 5000;

/**
 * Review and approve a proposal (W2.5). Opened from the vault screen, a
 * pasted link, or `cosignly://proposal/<hash>` (push notifications in W3).
 */
export default function ProposalScreen() {
  const { hash } = useLocalSearchParams<{ hash: string }>();
  const { colors } = useTheme();
  const load = useCallback(() => loadProposal(hash), [hash]);
  const data = useRemoteData(load);
  const ready = data.state.kind === "ready" ? data.state.data : undefined;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={data.refreshing}
          onRefresh={() => void data.refresh()}
          tintColor={colors.primary}
        />
      }
    >
      <Stack.Screen options={{ title: "Payment" }} />
      {data.state.kind === "loading" ? <ActivityIndicator color={colors.primary} /> : null}
      {data.state.kind === "error" ? (
        <Banner
          tone="warning"
          title="Couldn't load this payment"
          message="Pull down to try again."
        />
      ) : null}
      {ready === null ? (
        <Banner
          tone="warning"
          title="Payment not found"
          message="Nothing is waiting for approval under this link. It may have been removed after it expired."
        />
      ) : null}
      {ready && !ready.vault ? (
        <Banner
          tone="warning"
          title="The vault no longer exists"
          message={`Its account wasn't found on Stellar ${network.label}. The test network is reset from time to time.`}
        />
      ) : null}
      {ready?.vault ? (
        <ProposalBody hash={hash} status={ready.status} vault={ready.vault} reload={data.reload} />
      ) : null}
    </ScrollView>
  );
}

function ProposalBody({
  hash,
  status,
  vault,
  reload,
}: {
  hash: string;
  status: CoordinatorStatus;
  vault: AccountInfo;
  reload: () => Promise<void>;
}) {
  const { state: signer, unlock } = useSigner();
  const { names } = useVaultNames();
  const me = signer.status === "ready" ? signer.publicKey : "";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [signerError, setSignerError] = useState<SignerKeyError | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const labels = { ...names, ...(me ? { [me]: "You" } : {}) };
  const decoded = decodeTransaction(status.xdr, {
    network,
    usdc,
    labels,
    currentSigners: vault.signers,
  });
  const tx = decoded.ok ? decoded.tx : null;
  const review = reviewProposal({
    vault: toVault(vault),
    vaultSequence: vault.sequence,
    txSequence: tx?.sequence ?? "0",
    status,
    signer: me,
  });

  // Keep the screen current while it's open and something can still change.
  const live = review.phase === "collecting" || review.phase === "sending";
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [live, reload]);

  if (!tx) {
    return (
      <Banner
        tone="danger"
        title="Cosignly can't read this transaction"
        message="Don't approve it here. Ask the person who proposed it what it does."
      />
    );
  }

  const needsConfirm = tx.warnings.length > 0;

  const approve = async () => {
    setBusy(true);
    setMessage(null);
    setSignerError(null);
    try {
      // Re-check right before signing: someone may have approved meanwhile.
      const fresh = await loadProposal(hash);
      if (!fresh?.vault) {
        setMessage("This payment is no longer available.");
        return;
      }
      const again = reviewProposal({
        vault: toVault(fresh.vault),
        vaultSequence: fresh.vault.sequence,
        txSequence: tx.sequence,
        status: fresh.status,
        signer: me,
      });
      if (!again.canApprove) {
        setMessage("Enough signers approved meanwhile. Your approval isn't needed.");
        return;
      }
      const signedXdr = await unlock(`Approve: ${tx.title}`, (keypair) =>
        addSignatureToEnvelope(fresh.status.xdr, keypair, network),
      );
      const after = await coordinator.addSignature({ network: network.id, signedXdr });
      if (!after.signedBy.includes(me)) {
        setMessage("Your approval wasn't accepted. Pull down to refresh and try again.");
      }
    } catch (e) {
      if (e instanceof SignerKeyError) setSignerError(e);
      else setMessage("Couldn't send your approval. Check your connection and try again.");
    } finally {
      setBusy(false);
      await reload();
    }
  };

  const share = () =>
    void Share.share({
      message: proposalShareMessage(`${tx.title} (${vaultTitle(vault.id, names)})`, hash),
    });

  return (
    <>
      <Text variant="caption" color="textMuted">
        From {vaultTitle(vault.id, names)}
      </Text>
      <Text variant="title" accessibilityRole="header">
        {tx.title}
      </Text>

      <PhaseBanner phase={review.phase} status={status} tx={tx} vaultId={vault.id} hash={hash} />

      <Card>
        {tx.operations.length > 1 || tx.operations[0]?.lines.length
          ? tx.operations.map((op, i) => (
              <View key={i} style={styles.opRow}>
                <Text variant="body" color={op.flags.length ? "danger" : "text"}>
                  {op.lines.length ? op.lines.join("\n") : op.text}
                </Text>
              </View>
            ))
          : null}
        {tx.memo ? <Row label="Note" value={tx.memo.value} /> : null}
        {tx.validUntil ? <Row label="Expires" value={formatDate(tx.validUntil)} /> : null}
        <Row label="Network fee" value={`up to ${formatAmount(tx.maxFee)} XLM`} />
      </Card>

      {tx.warnings.map((w) => (
        <Banner key={w} tone="danger" title="Check before approving" message={w} />
      ))}

      <Approvals review={review} vault={vault} signedBy={status.signedBy} me={me} />

      {review.canApprove ? (
        <>
          {needsConfirm ? (
            <Checkbox
              label="I've read the warnings above and want to approve anyway."
              checked={confirmed}
              onChange={setConfirmed}
              tone="danger"
            />
          ) : null}
          {signerError ? <SignerErrorBanner error={signerError} /> : null}
          <Button
            label="Approve"
            icon={Fingerprint}
            fullWidth
            loading={busy}
            disabled={needsConfirm && !confirmed}
            onPress={() => void approve()}
            accessibilityHint={`Asks for ${biometricName} and adds your approval`}
          />
        </>
      ) : review.reason ? (
        <Text variant="callout" color="textMuted" align="center">
          {review.reason}
        </Text>
      ) : null}
      {message ? <Banner tone="info" title={message} /> : null}

      {review.phase === "collecting" ? (
        <>
          <Button
            label="Share signing link"
            icon={Share2}
            variant="secondary"
            fullWidth
            onPress={share}
          />
          <Text variant="caption" color="textMuted">
            Co-signers can open the link in Cosignly, or sign on Refractor with another Stellar
            wallet.
          </Text>
        </>
      ) : null}

      <Details tx={tx} status={status} hash={hash} />
    </>
  );
}

function PhaseBanner({
  phase,
  status,
  tx,
  vaultId,
  hash,
}: {
  phase: ProposalReview["phase"];
  status: CoordinatorStatus;
  tx: DecodedTransaction;
  vaultId: string;
  hash: string;
}) {
  switch (phase) {
    case "collecting":
      return null;
    case "sending":
      return (
        <Banner
          tone="info"
          title="Approved. Sending to Stellar…"
          message="Enough signers approved. This usually takes a few seconds."
        />
      );
    case "executed":
      return (
        <>
          <Banner tone="success" title="Sent" message={`${tx.title}. It's done on Stellar.`} />
          <Button
            label="View on stellar.expert"
            icon={ExternalLink}
            variant="secondary"
            fullWidth
            onPress={() => void Linking.openURL(explorerTransactionUrl(network, hash))}
          />
        </>
      );
    case "failed":
      return (
        <Banner
          tone="danger"
          title="Stellar didn't accept this payment"
          message={`Nothing was sent.${status.error ? ` Reason: ${status.error}.` : ""}`}
        />
      );
    case "expired":
      return (
        <Banner
          tone="warning"
          title="Expired"
          message="Not enough signers approved in time. Nothing was sent."
        />
      );
    case "stale":
      return (
        <>
          <Banner
            tone="warning"
            title="This payment can't be sent anymore"
            message="Another transaction from this vault went first. Nothing from this proposal was sent. Propose it again if it's still needed."
          />
          <Button
            label="Propose again"
            icon={Send}
            variant="secondary"
            fullWidth
            onPress={() => router.push({ pathname: "/propose/[vaultId]", params: { vaultId } })}
          />
        </>
      );
  }
}

function Approvals({
  review,
  vault,
  signedBy,
  me,
}: {
  review: ProposalReview;
  vault: AccountInfo;
  signedBy: string[];
  me: string;
}) {
  return (
    <Card>
      <QuorumProgress approvals={review.progress.approvals} required={review.progress.required} />
      {vault.signers.map((s) => {
        const approved = signedBy.includes(s.key);
        return (
          <View key={s.key} style={styles.signerRow}>
            <Icon
              icon={approved ? CircleCheck : Circle}
              color={approved ? "success" : "textMuted"}
            />
            <View style={styles.flex}>
              <AddressChip address={s.key} {...(s.key === me ? { name: "You" } : {})} />
            </View>
            <Text variant="caption" color={approved ? "success" : "textMuted"}>
              {approved ? "Approved" : "Waiting"}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

function Details({
  tx,
  status,
  hash,
}: {
  tx: DecodedTransaction;
  status: CoordinatorStatus;
  hash: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.details}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.detailsToggle}
      >
        <Icon icon={open ? ChevronDown : ChevronRight} color="textMuted" />
        <Text variant="callout" color="textMuted">
          Details
        </Text>
      </Pressable>
      {open ? (
        <Card>
          <Detail label="Transaction hash" value={hash} mono />
          <Detail label="Sequence number" value={tx.sequence} mono />
          <Detail label="Coordinator status" value={status.state} />
          <Detail label="Signatures" value={String(status.signedBy.length)} />
          <Detail label="Vault" value={truncateAddress(tx.source)} mono />
          <Button
            label="Open on Refractor"
            icon={ExternalLink}
            variant="ghost"
            onPress={() => void Linking.openURL(refractorTxUrl(hash))}
          />
        </Card>
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="callout" color="textMuted">
        {label}
      </Text>
      <Text variant="callout" style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detail}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text
        variant="caption"
        selectable
        style={mono ? { fontFamily: Platform.select(monoFontFamily) } : undefined}
      >
        {value}
      </Text>
    </View>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const styles = StyleSheet.create({
  content: { padding: screenPadding, gap: space.md, paddingBottom: space.huge },
  row: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  value: { flex: 1, textAlign: "right" },
  opRow: { gap: space.xxs },
  signerRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  flex: { flex: 1 },
  details: { gap: space.xs },
  detailsToggle: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 44 },
  detail: { gap: 2 },
});
