import {
  defaultTemplateFor,
  MAX_VAULT_SIGNERS,
  parseSignerAddress,
  signerAddressErrorMessage,
  templateConfig,
  VAULT_TEMPLATES,
  weightedConfig,
  type VaultConfig,
  type VaultIssueCode,
  type VaultTemplate,
} from "@cosignly/shared";

/** Longest vault name we accept (shown on cards and in notifications). */
export const MAX_VAULT_NAME_LENGTH = 32;
/** The wizard creates multisig vaults: you plus at least one other signer. */
export const MIN_VAULT_SIGNERS = 2;

export type Rules =
  | { kind: "template"; templateId: VaultTemplate["id"] }
  | {
      kind: "custom";
      /** Weight per signer key. */
      weights: Record<string, number>;
      payments: number;
      admin: number;
    };

export interface SetupState {
  name: string;
  /** Signer keys in display order. The first one is always this phone's key. */
  signers: string[];
  rules: Rules;
  /** Warnings the user explicitly accepted on the review screen. */
  confirmed: ReadonlySet<VaultIssueCode>;
}

export type SetupAction =
  | { type: "setName"; name: string }
  | { type: "addSigner"; key: string }
  | { type: "removeSigner"; key: string }
  | { type: "useTemplate"; templateId: VaultTemplate["id"] }
  | { type: "useCustom" }
  | { type: "setWeight"; key: string; weight: number }
  | { type: "setPayments"; value: number }
  | { type: "setAdmin"; value: number }
  | { type: "setConfirmed"; code: VaultIssueCode; confirmed: boolean };

export function initialSetupState(ownKey: string): SetupState {
  return {
    name: "",
    signers: [ownKey],
    rules: defaultRules([ownKey]),
    confirmed: new Set(),
  };
}

/** Majority for payments and signer changes; the matching template if there is one. */
export function defaultRules(signers: readonly string[]): Rules {
  const template = defaultTemplateFor(signers.length);
  if (template) return { kind: "template", templateId: template.id };
  return customRules(signers);
}

function customRules(signers: readonly string[]): Rules {
  const majority = Math.floor(signers.length / 2) + 1;
  const weights = Object.fromEntries(signers.map((k) => [k, 1]));
  return { kind: "custom", weights, payments: majority, admin: majority };
}

export function setupReducer(state: SetupState, action: SetupAction): SetupState {
  // Any change to signers or rules invalidates earlier confirmations.
  const reset = (next: Partial<SetupState>): SetupState => ({
    ...state,
    ...next,
    confirmed: new Set(),
  });

  switch (action.type) {
    case "setName":
      return { ...state, name: action.name.slice(0, MAX_VAULT_NAME_LENGTH) };
    case "addSigner": {
      if (state.signers.includes(action.key)) return state;
      const signers = [...state.signers, action.key];
      return reset({ signers, rules: defaultRules(signers) });
    }
    case "removeSigner": {
      // This phone's key always stays on the vault.
      if (action.key === state.signers[0]) return state;
      const signers = state.signers.filter((k) => k !== action.key);
      return reset({ signers, rules: defaultRules(signers) });
    }
    case "useTemplate":
      return reset({ rules: { kind: "template", templateId: action.templateId } });
    case "useCustom":
      return state.rules.kind === "custom" ? state : reset({ rules: customRules(state.signers) });
    case "setWeight":
    case "setPayments":
    case "setAdmin": {
      if (state.rules.kind !== "custom") return state;
      const rules = { ...state.rules, weights: { ...state.rules.weights } };
      if (action.type === "setWeight") rules.weights[action.key] = action.weight;
      if (action.type === "setPayments") rules.payments = action.value;
      if (action.type === "setAdmin") rules.admin = action.value;
      return reset({ rules });
    }
    case "setConfirmed": {
      const confirmed = new Set(state.confirmed);
      if (action.confirmed) confirmed.add(action.code);
      else confirmed.delete(action.code);
      return { ...state, confirmed };
    }
  }
}

/** The multisig configuration the wizard would create, or `null` if the template doesn't fit. */
export function configFromState(state: SetupState): VaultConfig | null {
  const { rules, signers } = state;
  if (rules.kind === "template") {
    const template = VAULT_TEMPLATES.find((t) => t.id === rules.templateId);
    return template ? templateConfig(template, signers) : null;
  }
  return weightedConfig(
    signers.map((key) => ({ key, weight: rules.weights[key] ?? 1 })),
    rules.payments,
    rules.admin,
  );
}

/** Checks a new signer address before adding it. Returns an error message or the address. */
export function checkNewSigner(
  input: string,
  signers: readonly string[],
): { ok: true; address: string } | { ok: false; message: string } {
  const parsed = parseSignerAddress(input);
  if (!parsed.ok) return { ok: false, message: signerAddressErrorMessage(parsed.error) };
  if (parsed.address === signers[0]) {
    return { ok: false, message: "This is your own address. You are already a signer." };
  }
  if (signers.includes(parsed.address)) {
    return { ok: false, message: "This signer is already on the list." };
  }
  if (signers.length >= MAX_VAULT_SIGNERS) {
    return { ok: false, message: `A vault can have at most ${MAX_VAULT_SIGNERS} signers.` };
  }
  return { ok: true, address: parsed.address };
}

export function trimmedName(state: SetupState): string {
  return state.name.trim();
}
