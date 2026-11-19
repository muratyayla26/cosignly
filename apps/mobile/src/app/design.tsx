import { Fingerprint, Plus } from "lucide-react-native";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import {
  AddressChip,
  AmountText,
  Banner,
  Button,
  Card,
  QuorumProgress,
  SegmentedControl,
  StatusBadge,
  Text,
  type ProposalBadgeStatus,
} from "@/components";
import { screenPadding, space, useTheme, type AppearancePreference } from "@/theme";

// Demo data only (docs/design.md §9).
const TEAM_VAULT = "GDDTBEBLVLD32OEMRUEXH7KEHYK5VRVN6ZXAJF7NIWMUG3ATUGTCNLOL";
const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const STATUSES: ProposalBadgeStatus[] = [
  "pending",
  "ready",
  "executed",
  "expired",
  "stale",
  "failed",
];
const APPEARANCE_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const satisfies readonly { value: AppearancePreference; label: string }[];

const noop = () => undefined;

/** Development-only gallery of the base components, for checking both themes. */
export default function DesignPreviewScreen() {
  const { preference, setPreference, scheme } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Section title="Appearance">
        <SegmentedControl
          accessibilityLabel="Appearance"
          options={APPEARANCE_OPTIONS}
          value={preference}
          onChange={setPreference}
        />
        <Text variant="caption" color="textMuted">
          Showing the {scheme} theme.
        </Text>
      </Section>

      <Section title="Proposal card (sample)">
        <Card elevated>
          <View style={styles.between}>
            <Text variant="callout" color="textMuted">
              Team Vault
            </Text>
            <StatusBadge status="pending" />
          </View>
          <Text variant="heading">Send 500 USDC to Alex</Text>
          <AmountText amount="500.0000000" assetCode="USDC" variant="amountLarge" />
          <QuorumProgress approvals={1} required={2} />
          <Button label="Approve" icon={Fingerprint} fullWidth onPress={noop} />
        </Card>
      </Section>

      <Section title="Text">
        <Text variant="display">Display</Text>
        <Text variant="title">Title</Text>
        <Text variant="heading">Heading</Text>
        <Text variant="body">Body — Payments need 2 of 3.</Text>
        <Text variant="bodyStrong">Body strong</Text>
        <Text variant="callout" color="textMuted">
          Callout, muted
        </Text>
        <Text variant="caption" color="textMuted">
          Caption, muted — Türkçe: ğüşıöç İĞÜŞÖÇ
        </Text>
      </Section>

      <Section title="Buttons">
        <Button label="Primary" onPress={noop} fullWidth />
        <Button label="Secondary" variant="secondary" icon={Plus} onPress={noop} fullWidth />
        <Button label="Ghost" variant="ghost" onPress={noop} />
        <Button label="Danger" variant="danger" onPress={noop} fullWidth />
        <Button label="Loading" loading onPress={noop} fullWidth />
        <Button label="Disabled" disabled onPress={noop} fullWidth />
      </Section>

      <Section title="Banners">
        <Banner tone="info" title="Payments need 2 of 3" message="Changing signers needs 2 of 3." />
        <Banner tone="success" title="Executed" message="500 USDC was sent to Alex." />
        <Banner
          tone="warning"
          title="Risky setup"
          message="If one signer loses their key, the others can no longer change signers."
        />
        <Banner tone="danger" title="Invalid setup" message="This vault could lock for good." />
      </Section>

      <Section title="Status badges">
        <View style={styles.wrap}>
          {STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </View>
      </Section>

      <Section title="Quorum progress">
        <QuorumProgress approvals={0} required={2} />
        <QuorumProgress approvals={1} required={2} />
        <QuorumProgress approvals={2} required={2} />
        <QuorumProgress approvals={2} required={3} size="sm" />
      </Section>

      <Section title="Addresses and amounts">
        <AddressChip address={TEAM_VAULT} name="Team Vault" showExplorerLink />
        <AddressChip address={ALEX} />
        <AmountText amount="9999.9999500" assetCode="XLM" />
        <AmountText amount="1234.5000000" assetCode="USDC" color="textMuted" />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="caption" color="textMuted">
        {title.toUpperCase()}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: screenPadding, gap: space.xl, paddingBottom: space.huge },
  section: { gap: space.xs },
  sectionBody: { gap: space.sm },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
