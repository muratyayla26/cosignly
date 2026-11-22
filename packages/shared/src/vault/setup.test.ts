import { Keypair } from "@stellar/stellar-sdk/base";
import { describe, expect, it } from "vitest";

import { describeThresholds } from "./describe";
import { validateVaultConfig, type VaultIssueCode } from "./rules";
import {
  defaultTemplateFor,
  equalWeightConfig,
  parseSignerAddress,
  reviewGate,
  setupReserve,
  signerAddressErrorMessage,
  templateConfig,
  thresholdsFor,
  VAULT_TEMPLATES,
  weightedConfig,
} from "./setup";

// Real testnet keys (see horizon/__fixtures__): Alex, Sam, Jordan.
const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const SAM = "GDGKPPMM5BORTIJLY2IC2OCU33OACYDRHMOUJAFRXHY4GTYOJD2QT4CY";
const JORDAN = "GDCHQZAQROW52J3O7WJUTFQMCB6HB7TJXVV33LPJS5PIHG3X5H55TXR5";
const five = [ALEX, SAM, JORDAN, Keypair.random().publicKey(), Keypair.random().publicKey()];

describe("parseSignerAddress", () => {
  it("accepts a plain address, trimming whitespace and fixing case", () => {
    expect(parseSignerAddress(`  ${ALEX.toLowerCase()}\n`)).toEqual({ ok: true, address: ALEX });
    expect(parseSignerAddress(`${ALEX.slice(0, 20)} ${ALEX.slice(20)}`)).toEqual({
      ok: true,
      address: ALEX,
    });
  });

  it("accepts wallet QR formats", () => {
    expect(parseSignerAddress(`stellar:${SAM}`)).toEqual({ ok: true, address: SAM });
    expect(parseSignerAddress(`web+stellar:pay?destination=${SAM}&amount=1`)).toEqual({
      ok: true,
      address: SAM,
    });
  });

  it("rejects empty and invalid input", () => {
    expect(parseSignerAddress("   ")).toEqual({ ok: false, error: "empty" });
    expect(parseSignerAddress("hello")).toEqual({ ok: false, error: "invalid" });
    expect(parseSignerAddress(ALEX.slice(0, -1) + "A")).toEqual({ ok: false, error: "invalid" });
  });

  it("rejects a secret key without echoing it", () => {
    const secret = Keypair.random().secret();
    const result = parseSignerAddress(secret);
    expect(result).toEqual({ ok: false, error: "secret-key" });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("has a message for every error", () => {
    for (const e of ["empty", "secret-key", "invalid"] as const) {
      expect(signerAddressErrorMessage(e)).toMatch(/\.$/);
    }
  });
});

describe("templates", () => {
  it.each(VAULT_TEMPLATES.map((t) => [t.label, t] as const))(
    "%s builds a valid equal-weight config",
    (_label, template) => {
      const keys = five.slice(0, template.signers);
      const config = templateConfig(template, keys);
      if (!config) throw new Error("expected a config");
      expect(config.masterWeight).toBe(0);
      expect(config.signers.every((s) => s.weight === 1)).toBe(true);
      expect(config.thresholds).toEqual({
        low: template.required,
        medium: template.required,
        high: template.required,
      });
      expect(validateVaultConfig(config).valid).toBe(true);
      expect(describeThresholds(config).summary).toBe(
        `Payments need ${template.label}. Changing signers needs ${template.label}.`,
      );
    },
  );

  it("returns null when the signer count doesn't match", () => {
    const twoOfThree = { id: "2-of-3", required: 2, signers: 3, label: "2 of 3" } as const;
    expect(templateConfig(twoOfThree, [ALEX, SAM])).toBeNull();
  });

  it("2 of 2 needs N-1 confirmation; 2 of 3 and 3 of 5 do not", () => {
    const issues = (id: string) => {
      const t = VAULT_TEMPLATES.find((x) => x.id === id);
      const config = t && templateConfig(t, five.slice(0, t.signers));
      if (!config) throw new Error(`no config for ${id}`);
      return validateVaultConfig(config).issues.map((i) => i.code);
    };
    expect(issues("2-of-2")).toEqual(["N_MINUS_ONE"]);
    expect(issues("2-of-3")).toEqual([]);
    expect(issues("3-of-5")).toEqual([]);
  });

  it("picks the template that fits the signer count", () => {
    expect(defaultTemplateFor(2)?.id).toBe("2-of-2");
    expect(defaultTemplateFor(3)?.id).toBe("2-of-3");
    expect(defaultTemplateFor(5)?.id).toBe("3-of-5");
    expect(defaultTemplateFor(4)).toBeUndefined();
  });
});

describe("custom configs", () => {
  it("sets low equal to the payment threshold", () => {
    expect(thresholdsFor(2, 3)).toEqual({ low: 2, medium: 2, high: 3 });
  });

  it("equal weights with separate payment and admin thresholds", () => {
    const config = equalWeightConfig([ALEX, SAM, JORDAN], 2, 3);
    expect(describeThresholds(config).summary).toBe(
      "Payments need 2 of 3. Changing signers needs 3 of 3.",
    );
    // Losing one signer leaves 2 < 3 for signer changes → N-1 warning.
    expect(validateVaultConfig(config).issues.map((i) => i.code)).toEqual(["N_MINUS_ONE"]);
  });

  it("weighted config copies signers and turns the master key off", () => {
    const input = [
      { key: ALEX, weight: 2 },
      { key: SAM, weight: 1 },
      { key: JORDAN, weight: 1 },
    ];
    const config = weightedConfig(input, 2, 3);
    expect(config.masterWeight).toBe(0);
    expect(config.signers).toEqual(input);
    expect(config.signers[0]).not.toBe(input[0]);
    expect(validateVaultConfig(config).issues.map((i) => i.code)).toEqual([
      "N_MINUS_ONE",
      "SINGLE_SIGNER_CAN_PAY",
    ]);
  });

  it("an impossible config is an error, not a warning", () => {
    const result = validateVaultConfig(equalWeightConfig([ALEX, SAM], 2, 3));
    expect(result.valid).toBe(false);
  });
});

describe("setupReserve", () => {
  it("2 of 3 with USDC keeps 3 XLM (matches the on-chain test vault)", () => {
    expect(setupReserve(3)).toEqual({
      base: "1.0000000",
      signers: "1.5000000",
      trustlines: "0.5000000",
      total: "3.0000000",
      signerCount: 3,
      trustlineCount: 1,
      perEntry: "0.5000000",
    });
  });

  it("scales with signers and trustlines", () => {
    expect(setupReserve(5).total).toBe("4.0000000");
    expect(setupReserve(2, 0).total).toBe("2.0000000");
  });
});

describe("reviewGate", () => {
  const none = new Set<VaultIssueCode>();

  it("allows a clean valid config", () => {
    const v = validateVaultConfig(equalWeightConfig([ALEX, SAM, JORDAN], 2, 2));
    expect(reviewGate(v, none)).toEqual({ canSubmit: true, unconfirmed: [] });
  });

  it("never allows an invalid config, even with everything confirmed", () => {
    const v = validateVaultConfig(equalWeightConfig([ALEX, SAM], 2, 3));
    const all = new Set<VaultIssueCode>(v.issues.map((i) => i.code));
    expect(reviewGate(v, all).canSubmit).toBe(false);
  });

  it("needs each warning confirmed separately", () => {
    const v = validateVaultConfig(
      weightedConfig(
        [
          { key: ALEX, weight: 2 },
          { key: SAM, weight: 1 },
        ],
        2,
        3,
      ),
    );
    expect(reviewGate(v, none)).toEqual({
      canSubmit: false,
      unconfirmed: ["N_MINUS_ONE", "SINGLE_SIGNER_CAN_PAY"],
    });
    expect(reviewGate(v, new Set(["N_MINUS_ONE"])).unconfirmed).toEqual(["SINGLE_SIGNER_CAN_PAY"]);
    expect(reviewGate(v, new Set(["N_MINUS_ONE", "SINGLE_SIGNER_CAN_PAY"])).canSubmit).toBe(true);
  });
});
