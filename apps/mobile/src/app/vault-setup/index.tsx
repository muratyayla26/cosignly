import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";

import { Button, TextField } from "@/components";
import { MAX_VAULT_NAME_LENGTH, trimmedName } from "@/vaultSetup/state";
import { StepLayout } from "@/vaultSetup/StepLayout";
import { useVaultSetup } from "@/vaultSetup/VaultSetupProvider";

/** Step 1: vault name (kept on this phone only). */
export default function VaultNameStep() {
  const { state, dispatch } = useVaultSetup();
  const canContinue = trimmedName(state) !== "";
  const next = () => {
    if (canContinue) router.push("/vault-setup/signers");
  };

  return (
    <StepLayout
      step={1}
      title="Name your vault"
      intro="A vault is a shared Stellar account. Money leaves it only when enough signers approve."
      footer={
        <Button label="Next" icon={ArrowRight} fullWidth disabled={!canContinue} onPress={next} />
      }
    >
      <TextField
        label="Vault name"
        value={state.name}
        onChangeText={(name) => dispatch({ type: "setName", name })}
        placeholder="Team Vault"
        maxLength={MAX_VAULT_NAME_LENGTH}
        hint="Only you see this name. It is saved on this phone, not on Stellar."
        autoFocus
        returnKeyType="next"
        onSubmitEditing={next}
      />
    </StepLayout>
  );
}
