import {
  approvalProgress,
  availableToSend,
  buildPaymentProposal,
  checkPaymentDraft,
  decodeTransaction,
  formatAmount,
  refractorTxUrl,
  RefractorError,
  toVault,
  XLM,
  type AccountInfo,
  type DecodedTransaction,
  type PaymentDraft,
  type PaymentField,
} from "@cosignly/shared";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ArrowRight, ClipboardPaste, ExternalLink, Fingerprint } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import {
  Banner,
  Button,
  Card,
  KeyboardAvoidingScreen,
  QuorumProgress,
  SegmentedControl,
  Text,
  TextField,
} from "@/components";
import { coordinator, horizon, network, usdc } from "@/lib/stellar";
import { loadPendingProposal, saveLocalProposal, type PendingProposal } from "@/proposals/store";
import { biometricName, SignerErrorBanner, SignerKeyError, useSigner } from "@/signer";
import { screenPadding, space, useTheme } from "@/theme";
import { useVaultNames, vaultTitle } from "@/vaults/names";

type Phase =
  | { kind: "loading" }
  | { kind: "unavailable"; message: string }
  | { kind: "blocked"; pending: PendingProposal }
  | { kind: "form" }
  | { kind: "confirm"; summary: DecodedTransaction }
  | { kind: "done"; hash: string; approvals: number; required: number };

const ASSETS = [
  { value: "XLM", label: "XLM" },
  { value: "USDC", label: "USDC" },
] as const;

const emptyDraft: PaymentDraft = { asset: "XLM", destination: "", amount: "", memo: "" };

/** Propose a payment from a vault: fill in → review → sign with biometrics → upload for approval. */
export default function ProposePaymentScreen() {
  const { vaultId } = useLocalSearchParams<{ vaultId: string }>();
  const { colors } = useTheme();
  const { state: signer, unlock } = useSigner();
  const { names } = useVaultNames();
  const me = signer.status === "ready" ? signer.publicKey : "";
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [vault, setVault] = useState<AccountInfo | null>(null);
  const [draft, setDraft] = useState<PaymentDraft>(emptyDraft);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PaymentField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signerError, setSignerError] = useState<SignerKeyError | null>(null);

  const labels = { ...names, ...(me ? { [me]: "You" } : {}) };

  /** Fresh vault account + the one-pending-proposal rule. Sets no state itself. */
  const loadVault = useCallback(async (): Promise<{ account: AccountInfo } | { phase: Phase }> => {
    const account = await horizon.getAccount(vaultId);
    if (!account) {
      return { phase: { kind: "unavailable", message: "This vault was not found on Stellar." } };
    }
    if (!account.signers.some((s) => s.key === me)) {
      return { phase: { kind: "unavailable", message: "Your key is not a signer of this vault." } };
    }
    const pending = await loadPendingProposal(account, coordinator);
    if (pending?.open) return { phase: { kind: "blocked", pending } };
    return { account };
  }, [vaultId, me]);

  useEffect(() => {
    let active = true;
    loadVault()
      .then((result) => {
        if (!active) return;
        if ("phase" in result) {
          setPhase(result.phase);
          return;
        }
        setVault(result.account);
        setPhase({ kind: "form" });
      })
      .catch(() => {
        if (active) {
          setPhase({
            kind: "unavailable",
            message: "Couldn't reach Stellar. Go back and try again.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [loadVault]);

  const update = (patch: Partial<PaymentDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setFieldErrors({});
    setError(null);
  };

  const review = async () => {
    if (!vault) return;
    setBusy(true);
    setError(null);
    try {
      const destination = draft.destination.trim().toUpperCase();
      const formatOnly = checkPaymentDraft(draft, { vault, recipient: undefined, usdc });
      const recipient = formatOnly.some((i) => i.field === "destination")
        ? undefined
        : await horizon.getAccount(destination);
      const issues = checkPaymentDraft(draft, { vault, recipient, usdc });
      if (issues.length > 0) {
        setFieldErrors(Object.fromEntries(issues.map((i) => [i.field, i.message])));
        return;
      }
      const preview = buildPaymentProposal({ vault, draft, usdc, network });
      const decoded = decodeTransaction(preview.toXDR(), { network, usdc, labels });
      if (!decoded.ok) throw new Error(decoded.error);
      setPhase({ kind: "confirm", summary: decoded.tx });
    } catch {
      setError("Couldn't check the recipient on Stellar. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const signAndPropose = async () => {
    setBusy(true);
    setError(null);
    setSignerError(null);
    try {
      // Fresh sequence number, and nobody proposed in the meantime.
      const result = await loadVault();
      if ("phase" in result) {
        setPhase(result.phase);
        return;
      }
      const account = result.account;
      const tx = buildPaymentProposal({ vault: account, draft, usdc, network });
      const signedXdr = await unlock(`Sign: ${summaryTitle(phase)}`, (keypair) => {
        tx.sign(keypair);
        return tx.toXDR();
      });
      const maxTime = tx.timeBounds?.maxTime;
      const expiresAt = maxTime ? new Date(Number(maxTime) * 1000) : undefined;
      const ref = await coordinator.propose({
        network: network.id,
        xdr: signedXdr,
        submitWhenReady: true,
        ...(expiresAt ? { expiresAt } : {}),
      });
      const status = await coordinator.getStatus(ref);
      const decoded = decodeTransaction(tx.toXDR(), { network, usdc, labels });
      await saveLocalProposal({
        vaultId: account.id,
        hash: ref.hash,
        title: decoded.ok ? decoded.tx.title : "Payment",
        sequence: tx.sequence,
        createdAt: new Date().toISOString(),
        ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
      });
      const progress = approvalProgress(toVault(account), status.signedBy);
      setPhase({
        kind: "done",
        hash: ref.hash,
        approvals: progress.approvals,
        required: progress.required,
      });
    } catch (e) {
      if (e instanceof RefractorError) {
        setError(`The proposal couldn't be uploaded for approval. ${e.message}`);
      } else if (e instanceof SignerKeyError) {
        setSignerError(e);
      } else {
        setError("Something went wrong. Check your connection and try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const title = vaultTitle(vaultId, names);

  return (
    // The whole screen makes room for the keyboard; on iOS the ScrollView also
    // scrolls the focused field into view (Android does that by itself).
    <KeyboardAvoidingScreen>
      <Stack.Screen options={{ title: phase.kind === "done" ? "Proposed" : "Propose payment" }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text variant="caption" color="textMuted">
          From {title}
        </Text>

        {phase.kind === "loading" ? <ActivityIndicator color={colors.primary} /> : null}
        {phase.kind === "unavailable" ? (
          <Banner tone="warning" title="Can't propose from this vault" message={phase.message} />
        ) : null}

        {phase.kind === "blocked" ? (
          <>
            <Banner
              tone="info"
              title="A payment is already waiting for approval"
              message={`"${phase.pending.local.title}" needs to be approved or expire before this vault can propose another payment.`}
            />
            <Button
              label="View on Refractor"
              icon={ExternalLink}
              variant="secondary"
              fullWidth
              onPress={() => void Linking.openURL(refractorTxUrl(phase.pending.local.hash))}
            />
          </>
        ) : null}

        {phase.kind === "form" && vault ? (
          <Form
            vault={vault}
            draft={draft}
            errors={fieldErrors}
            onChange={update}
            onReview={() => void review()}
            busy={busy}
          />
        ) : null}

        {phase.kind === "confirm" ? (
          <>
            <Card>
              <Text variant="heading">{phase.summary.title}</Text>
              {phase.summary.memo ? <Row label="Note" value={phase.summary.memo.value} /> : null}
              {phase.summary.validUntil ? (
                <Row label="Expires" value={formatDate(phase.summary.validUntil)} />
              ) : null}
              <Row label="Network fee" value={`up to ${formatAmount(phase.summary.maxFee)} XLM`} />
            </Card>
            <Text variant="callout" color="textMuted">
              Your approval counts as the first one. The other signers approve it in Cosignly;
              signers who use another wallet can sign on Refractor. It is sent automatically once
              enough signers approve.
            </Text>
            {signerError ? <SignerErrorBanner error={signerError} /> : null}
            <Button
              label="Sign and propose"
              icon={Fingerprint}
              fullWidth
              loading={busy}
              onPress={() => void signAndPropose()}
              accessibilityHint={`Asks for ${biometricName} and uploads the proposal`}
            />
            <Button
              label="Edit"
              variant="ghost"
              fullWidth
              disabled={busy}
              onPress={() => setPhase({ kind: "form" })}
            />
          </>
        ) : null}

        {phase.kind === "done" ? (
          <>
            <Banner
              tone="success"
              title="Payment proposed"
              message="It is waiting for the other signers. It is sent automatically once enough of them approve."
            />
            <Card>
              <QuorumProgress approvals={phase.approvals} required={phase.required} />
            </Card>
            <Button
              label="View on Refractor"
              icon={ExternalLink}
              variant="secondary"
              fullWidth
              onPress={() => void Linking.openURL(refractorTxUrl(phase.hash))}
            />
            <Button label="Done" fullWidth onPress={() => router.back()} />
          </>
        ) : null}

        {error ? <Banner tone="danger" title="Not proposed" message={error} /> : null}
      </ScrollView>
    </KeyboardAvoidingScreen>
  );
}

function Form({
  vault,
  draft,
  errors,
  onChange,
  onReview,
  busy,
}: {
  vault: AccountInfo;
  draft: PaymentDraft;
  errors: Partial<Record<PaymentField, string>>;
  onChange: (patch: Partial<PaymentDraft>) => void;
  onReview: () => void;
  busy: boolean;
}) {
  const available = availableToSend(vault, draft.asset === "USDC" ? usdc : XLM);
  const paste = async () => onChange({ destination: (await Clipboard.getStringAsync()).trim() });

  return (
    <>
      <SegmentedControl
        accessibilityLabel="Asset"
        options={ASSETS}
        value={draft.asset}
        onChange={(asset) => onChange({ asset })}
      />
      {errors.asset ? (
        <Text variant="caption" color="danger">
          {errors.asset}
        </Text>
      ) : null}
      <TextField
        label="Recipient"
        value={draft.destination}
        onChangeText={(destination) => onChange({ destination })}
        placeholder="G…"
        error={errors.destination ?? null}
        mono
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
      />
      <Button label="Paste" icon={ClipboardPaste} variant="ghost" onPress={() => void paste()} />
      <TextField
        label={`Amount (${draft.asset})`}
        value={draft.amount}
        onChangeText={(amount) => onChange({ amount: amount.replace(",", ".") })}
        placeholder="0"
        keyboardType="decimal-pad"
        error={errors.amount ?? null}
        hint={`Available: ${formatAmount(available)} ${draft.asset}`}
      />
      <TextField
        label="Note (optional)"
        value={draft.memo}
        onChangeText={(memo) => onChange({ memo })}
        placeholder="e.g. Invoice 42"
        error={errors.memo ?? null}
        hint="Visible to everyone on Stellar. Up to 28 characters."
        maxLength={28}
      />
      <Button label="Review" icon={ArrowRight} fullWidth loading={busy} onPress={onReview} />
    </>
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

function summaryTitle(phase: Phase): string {
  return phase.kind === "confirm" ? phase.summary.title : "payment proposal";
}

function formatDate(date: Date): string {
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const styles = StyleSheet.create({
  content: { padding: screenPadding, gap: space.md, paddingBottom: space.huge },
  row: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  value: { flex: 1, textAlign: "right" },
});
