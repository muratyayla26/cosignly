import { MAX_WEIGHT, sumWeights, VAULT_TEMPLATES, validateVaultConfig } from "@cosignly/shared";
import { router } from "expo-router";
import { ArrowRight, Circle, CircleDot } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { Banner, Button, Card, Icon, Stepper, Text, ThresholdSummary } from "@/components";
import { radius, space, useTheme } from "@/theme";
import { configFromState } from "@/vaultSetup/state";
import { StepLayout } from "@/vaultSetup/StepLayout";
import { useVaultSetup } from "@/vaultSetup/VaultSetupProvider";

/** Step 3: how many approvals payments and signer changes need. */
export default function RulesStep() {
  const { state, dispatch } = useVaultSetup();
  const { rules, signers } = state;
  const config = configFromState(state);
  const validation = config ? validateVaultConfig(config) : null;
  const total = sumWeights(config?.signers ?? []);

  return (
    <StepLayout
      step={3}
      title="Approval rules"
      intro="Choose how many signers must approve. Payments and changes to the signers are set separately."
      footer={
        <Button
          label="Review"
          icon={ArrowRight}
          fullWidth
          disabled={!validation?.valid}
          onPress={() => router.push("/vault-setup/review")}
        />
      }
    >
      <View accessibilityRole="radiogroup" accessibilityLabel="Approval rules" style={styles.list}>
        {VAULT_TEMPLATES.map((t) => {
          const fits = t.signers === signers.length;
          return (
            <Option
              key={t.id}
              title={t.label}
              description={
                fits
                  ? `Any ${t.required} of the ${t.signers} signers approve payments and signer changes.`
                  : `For ${t.signers} signers. You have ${signers.length}.`
              }
              selected={rules.kind === "template" && rules.templateId === t.id}
              disabled={!fits}
              onPress={() => dispatch({ type: "useTemplate", templateId: t.id })}
            />
          );
        })}
        <Option
          title="Custom"
          description="Set approvals for payments and signer changes, and give signers different weights."
          selected={rules.kind === "custom"}
          onPress={() => dispatch({ type: "useCustom" })}
        />
      </View>

      {rules.kind === "custom" ? (
        <Card>
          <Text variant="bodyStrong">Signer weights</Text>
          <Text variant="caption" color="textMuted">
            Each signer's approval counts this much. Keep everyone at 1 for a simple "N of M".
          </Text>
          {signers.map((key, i) => (
            <Stepper
              key={key}
              label={i === 0 ? "You" : `Signer ${i + 1}`}
              value={rules.weights[key] ?? 1}
              min={1}
              max={MAX_WEIGHT}
              onChange={(weight) => dispatch({ type: "setWeight", key, weight })}
            />
          ))}
          <Text variant="bodyStrong">Approvals needed</Text>
          <Stepper
            label="Payments"
            value={rules.payments}
            min={1}
            max={total}
            suffix={`of ${total}`}
            onChange={(value) => dispatch({ type: "setPayments", value })}
          />
          <Stepper
            label="Changing signers"
            value={rules.admin}
            min={1}
            max={total}
            suffix={`of ${total}`}
            onChange={(value) => dispatch({ type: "setAdmin", value })}
          />
        </Card>
      ) : null}

      {config ? (
        <Card>
          <Text variant="bodyStrong">In plain words</Text>
          <ThresholdSummary config={config} />
        </Card>
      ) : (
        <Banner
          tone="warning"
          title="Pick a rule"
          message="Choose a rule that fits your signers."
        />
      )}
    </StepLayout>
  );
}

function Option({
  title,
  description,
  selected,
  disabled = false,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.option,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Icon icon={selected ? CircleDot : Circle} color={selected ? "primary" : "textMuted"} />
      <View style={styles.optionText}>
        <Text variant="bodyStrong" tabular>
          {title}
        </Text>
        <Text variant="callout" color="textMuted">
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  option: {
    flexDirection: "row",
    gap: space.sm,
    alignItems: "flex-start",
    padding: space.md,
    borderRadius: radius.lg,
  },
  optionText: { flex: 1, gap: space.xxs },
});
