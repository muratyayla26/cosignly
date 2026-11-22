import {
  formatAmount,
  reviewGate,
  setupReserve,
  validateVaultConfig,
  type VaultIssue,
  type VaultIssueCode,
} from "@cosignly/shared";
import { ShieldCheck } from "lucide-react-native";
import { Alert, StyleSheet, View } from "react-native";

import {
  AddressChip,
  AmountText,
  Banner,
  Button,
  Card,
  Checkbox,
  Text,
  ThresholdSummary,
} from "@/components";
import { space, useTheme } from "@/theme";
import { configFromState, trimmedName } from "@/vaultSetup/state";
import { StepLayout } from "@/vaultSetup/StepLayout";
import { useVaultSetup } from "@/vaultSetup/VaultSetupProvider";

const WARNING_TITLE: Partial<Record<VaultIssueCode, string>> = {
  N_MINUS_ONE: "Risk of locking the vault",
  SINGLE_SIGNER_CAN_PAY: "One signer can pay alone",
};

const CONFIRM_LABEL: Partial<Record<VaultIssueCode, string>> = {
  N_MINUS_ONE: "I understand that if one signer loses their key, this vault may be locked.",
  SINGLE_SIGNER_CAN_PAY: "I understand that one signer can send payments without the others.",
};

/** Step 4: everything the vault will be, checked by the lockout rules. */
export default function ReviewStep() {
  const { colors } = useTheme();
  const { state, dispatch } = useVaultSetup();
  const config = configFromState(state);
  // The rules step blocks invalid configs, but check again here: this screen is the gate.
  const validation = config ? validateVaultConfig(config) : null;
  const gate = validation ? reviewGate(validation, state.confirmed) : null;
  const canSubmit = gate?.canSubmit === true && trimmedName(state) !== "";
  const reserve = setupReserve(state.signers.length);
  const errors = validation?.issues.filter((i) => i.severity === "error") ?? [];
  const warnings = validation?.issues.filter((i) => i.severity === "warning") ?? [];
  const equalWeights = config?.signers.every((s) => s.weight === 1) ?? true;

  const create = () => {
    if (!canSubmit) return;
    // Building and submitting the vault transaction is W2.2.
    Alert.alert("Not available yet", "Creating the vault on Stellar comes in the next update.");
  };

  return (
    <StepLayout
      step={4}
      title="Review your vault"
      footer={
        <>
          {gate && gate.unconfirmed.length > 0 && errors.length === 0 ? (
            <Text variant="caption" color="warning" align="center">
              Confirm the warnings above to continue.
            </Text>
          ) : null}
          <Button
            label="Create vault"
            icon={ShieldCheck}
            fullWidth
            disabled={!canSubmit}
            onPress={create}
          />
        </>
      }
    >
      <Card>
        <Text variant="caption" color="textMuted">
          Name
        </Text>
        <Text variant="heading">{trimmedName(state)}</Text>
      </Card>

      <Card>
        <Text variant="bodyStrong">Signers</Text>
        {state.signers.map((key, i) => (
          <View key={key} style={styles.signerRow}>
            <View style={styles.flex}>
              <AddressChip address={key} name={i === 0 ? "You" : `Signer ${i + 1}`} />
            </View>
            {equalWeights ? null : (
              <Text variant="callout" color="textMuted" tabular>
                weight {config?.signers[i]?.weight}
              </Text>
            )}
          </View>
        ))}
      </Card>

      <Card>
        <Text variant="bodyStrong">Approval rules</Text>
        {config ? <ThresholdSummary config={config} showIssues={false} /> : null}
      </Card>

      {config === null ? (
        <Banner
          tone="danger"
          title="Rules don't match the signers"
          message="Go back and choose approval rules for this number of signers."
        />
      ) : null}
      {errors.map((issue) => (
        <Banner
          key={issue.code}
          tone="danger"
          title="This setup can't be used"
          message={issue.message}
        />
      ))}
      {warnings.map((issue) => (
        <WarningConfirm
          key={issue.code}
          issue={issue}
          confirmed={state.confirmed.has(issue.code)}
          onChange={(confirmed) => dispatch({ type: "setConfirmed", code: issue.code, confirmed })}
        />
      ))}

      <Card>
        <Text variant="bodyStrong">XLM kept in the vault</Text>
        <Text variant="callout" color="textMuted">
          Stellar requires every account to hold a minimum XLM balance:{" "}
          {formatAmount(reserve.perEntry)} XLM for each signer and for the USDC trustline, on top of
          a base amount. It isn't a fee, but it can't be sent while the vault has these signers. On
          testnet, free test XLM covers it.
        </Text>
        <ReserveRow label="Base" amount={reserve.base} />
        <ReserveRow
          label={`${reserve.signerCount} signer${reserve.signerCount === 1 ? "" : "s"}`}
          amount={reserve.signers}
        />
        <ReserveRow label="USDC trustline" amount={reserve.trustlines} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <ReserveRow label="Minimum balance" amount={reserve.total} strong />
      </Card>
    </StepLayout>
  );
}

function WarningConfirm({
  issue,
  confirmed,
  onChange,
}: {
  issue: VaultIssue;
  confirmed: boolean;
  onChange: (confirmed: boolean) => void;
}) {
  return (
    <View style={styles.warning}>
      <Banner
        tone="warning"
        title={WARNING_TITLE[issue.code] ?? "Check this"}
        message={issue.message}
      />
      <Checkbox
        label={CONFIRM_LABEL[issue.code] ?? "I understand this risk."}
        checked={confirmed}
        onChange={onChange}
        tone="warning"
      />
    </View>
  );
}

function ReserveRow({
  label,
  amount,
  strong = false,
}: {
  label: string;
  amount: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.reserveRow}>
      <Text variant={strong ? "bodyStrong" : "body"}>{label}</Text>
      <AmountText amount={amount} assetCode="XLM" variant={strong ? "bodyStrong" : "body"} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  signerRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  warning: { gap: space.xs },
  reserveRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  divider: { height: StyleSheet.hairlineWidth },
});
