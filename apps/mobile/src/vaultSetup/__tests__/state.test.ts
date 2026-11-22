import { generateSignerKeypair } from "@cosignly/shared";

import {
  checkNewSigner,
  configFromState,
  initialSetupState,
  MAX_VAULT_NAME_LENGTH,
  setupReducer,
  type SetupAction,
  type SetupState,
} from "../state";

// Real testnet keys (packages/shared fixtures): Alex, Sam, Jordan.
const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const SAM = "GDGKPPMM5BORTIJLY2IC2OCU33OACYDRHMOUJAFRXHY4GTYOJD2QT4CY";
const JORDAN = "GDCHQZAQROW52J3O7WJUTFQMCB6HB7TJXVV33LPJS5PIHG3X5H55TXR5";

const run = (...actions: SetupAction[]): SetupState =>
  actions.reduce(setupReducer, initialSetupState(ALEX));

describe("vault setup state", () => {
  it("starts with this phone's key and caps the name length", () => {
    const state = run({ type: "setName", name: "x".repeat(50) });
    expect(state.signers).toEqual([ALEX]);
    expect(state.name).toHaveLength(MAX_VAULT_NAME_LENGTH);
  });

  it("preselects the template that fits the signer count", () => {
    expect(run({ type: "addSigner", key: SAM }).rules).toEqual({
      kind: "template",
      templateId: "2-of-2",
    });
    const three = run({ type: "addSigner", key: SAM }, { type: "addSigner", key: JORDAN });
    expect(three.rules).toEqual({ kind: "template", templateId: "2-of-3" });
    expect(configFromState(three)).toEqual({
      signers: [ALEX, SAM, JORDAN].map((key) => ({ key, weight: 1 })),
      thresholds: { low: 2, medium: 2, high: 2 },
      masterWeight: 0,
    });
  });

  it("falls back to a majority custom rule when no template fits", () => {
    const four = run(
      { type: "addSigner", key: SAM },
      { type: "addSigner", key: JORDAN },
      { type: "addSigner", key: generateSignerKeypair().publicKey() },
    );
    expect(four.rules).toMatchObject({ kind: "custom", payments: 3, admin: 3 });
  });

  it("never removes this phone's key and ignores duplicates", () => {
    const state = run(
      { type: "addSigner", key: SAM },
      { type: "addSigner", key: SAM },
      { type: "removeSigner", key: ALEX },
    );
    expect(state.signers).toEqual([ALEX, SAM]);
    expect(
      run({ type: "addSigner", key: SAM }, { type: "removeSigner", key: SAM }).signers,
    ).toEqual([ALEX]);
  });

  it("returns no config for a template that doesn't fit", () => {
    const state = run(
      { type: "addSigner", key: SAM },
      { type: "useTemplate", templateId: "2-of-3" },
    );
    expect(configFromState(state)).toBeNull();
  });

  it("edits weights and thresholds only in custom mode", () => {
    const base = run({ type: "addSigner", key: SAM }, { type: "addSigner", key: JORDAN });
    expect(setupReducer(base, { type: "setPayments", value: 1 })).toBe(base);

    const custom = [
      { type: "useCustom" },
      { type: "setWeight", key: ALEX, weight: 2 },
      { type: "setPayments", value: 2 },
      { type: "setAdmin", value: 3 },
    ] satisfies SetupAction[];
    const state = custom.reduce(setupReducer, base);
    expect(setupReducer(state, { type: "useCustom" })).toBe(state);
    expect(configFromState(state)).toEqual({
      signers: [
        { key: ALEX, weight: 2 },
        { key: SAM, weight: 1 },
        { key: JORDAN, weight: 1 },
      ],
      thresholds: { low: 2, medium: 2, high: 3 },
      masterWeight: 0,
    });
  });

  it("drops earlier warning confirmations when the setup changes", () => {
    const confirmed = run(
      { type: "addSigner", key: SAM },
      { type: "setConfirmed", code: "N_MINUS_ONE", confirmed: true },
    );
    expect(confirmed.confirmed.has("N_MINUS_ONE")).toBe(true);
    expect(setupReducer(confirmed, { type: "setName", name: "Team Vault" }).confirmed.size).toBe(1);
    expect(setupReducer(confirmed, { type: "addSigner", key: JORDAN }).confirmed.size).toBe(0);
    expect(
      setupReducer(confirmed, { type: "setConfirmed", code: "N_MINUS_ONE", confirmed: false })
        .confirmed.size,
    ).toBe(0);
  });
});

describe("checkNewSigner", () => {
  it("accepts a new address", () => {
    expect(checkNewSigner(` ${SAM} `, [ALEX])).toEqual({ ok: true, address: SAM });
  });

  it.each([
    ["", "Enter a Stellar address."],
    [ALEX, "This is your own address. You are already a signer."],
    [SAM, "This signer is already on the list."],
  ])("rejects %j", (input, message) => {
    expect(checkNewSigner(input, [ALEX, SAM])).toEqual({ ok: false, message });
  });

  it("rejects a secret key without echoing it", () => {
    const secret = generateSignerKeypair().secret();
    const result = checkNewSigner(secret, [ALEX]);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("stops at 20 signers", () => {
    const keys = [ALEX, ...Array.from({ length: 19 }, () => generateSignerKeypair().publicKey())];
    expect(checkNewSigner(SAM, keys)).toEqual({
      ok: false,
      message: "A vault can have at most 20 signers.",
    });
  });
});
