import { Keypair } from "@stellar/stellar-sdk/base";
import { describe, expect, it } from "vitest";

import { MASTER_KEY, activeSigners, validateVaultConfig, type VaultIssueCode } from "./rules";
import type { VaultConfig, VaultSigner } from "./types";

// Real testnet keys (see horizon/__fixtures__): Alex, Sam, Jordan.
const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const SAM = "GDGKPPMM5BORTIJLY2IC2OCU33OACYDRHMOUJAFRXHY4GTYOJD2QT4CY";
const JORDAN = "GDCHQZAQROW52J3O7WJUTFQMCB6HB7TJXVV33LPJS5PIHG3X5H55TXR5";
const TAYLOR = Keypair.random().publicKey();
const RILEY = Keypair.random().publicKey();

const signers = (...entries: [string, number][]): VaultSigner[] =>
  entries.map(([key, weight]) => ({ key, weight }));

const config = (overrides: Partial<VaultConfig> = {}): VaultConfig => ({
  signers: signers([ALEX, 1], [SAM, 1], [JORDAN, 1]),
  thresholds: { low: 1, medium: 2, high: 2 },
  masterWeight: 0,
  ...overrides,
});

const codes = (c: VaultConfig): VaultIssueCode[] =>
  validateVaultConfig(c).issues.map((i) => i.code);

describe("validateVaultConfig — templates", () => {
  it.each([
    ["2 of 2", signers([ALEX, 1], [SAM, 1]), { low: 1, medium: 2, high: 2 }, ["N_MINUS_ONE"]],
    ["2 of 3", signers([ALEX, 1], [SAM, 1], [JORDAN, 1]), { low: 1, medium: 2, high: 2 }, []],
    [
      "3 of 5",
      signers([ALEX, 1], [SAM, 1], [JORDAN, 1], [TAYLOR, 1], [RILEY, 1]),
      { low: 1, medium: 3, high: 3 },
      [],
    ],
  ] as const)("%s", (_name, s, thresholds, expected) => {
    const result = validateVaultConfig(config({ signers: [...s], thresholds: { ...thresholds } }));
    expect(result.valid).toBe(true);
    expect(result.issues.map((i) => i.code)).toEqual(expected);
    expect(result.requiresConfirmation).toBe(expected.length > 0);
  });
});

describe("rule 1: total weight must reach the high threshold", () => {
  it("rejects a vault whose signers can never reach high", () => {
    const result = validateVaultConfig(config({ thresholds: { low: 1, medium: 2, high: 4 } }));
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "TOTAL_WEIGHT_BELOW_HIGH", severity: "error" }),
    ]);
    expect(result.issues[0]?.message).toContain("weight 3");
  });

  it("accepts total weight exactly equal to high", () => {
    expect(validateVaultConfig(config({ thresholds: { low: 1, medium: 3, high: 3 } })).valid).toBe(
      true,
    );
  });

  it("counts an active master key towards the total", () => {
    const c = config({ signers: signers([ALEX, 1]), masterWeight: 1 });
    expect(codes(c)).not.toContain("TOTAL_WEIGHT_BELOW_HIGH");
  });
});

describe("rule 2: N-1 (losing one signer must not lock the vault)", () => {
  it("warns when losing one signer blocks signer changes but not payments", () => {
    const result = validateVaultConfig(config({ thresholds: { low: 1, medium: 2, high: 3 } }));
    expect(result.valid).toBe(true);
    expect(result.requiresConfirmation).toBe(true);
    const issue = result.issues.find((i) => i.code === "N_MINUS_ONE");
    expect(issue?.severity).toBe("warning");
    expect(issue?.message).toContain("can still send payments");
    expect(issue?.signers).toEqual([ALEX, SAM, JORDAN]);
  });

  it("warns more strongly when losing one signer also blocks payments", () => {
    const result = validateVaultConfig(config({ thresholds: { low: 3, medium: 3, high: 3 } }));
    const issue = result.issues.find((i) => i.code === "N_MINUS_ONE");
    expect(issue?.message).toContain("can no longer send payments");
  });

  it("only names the signers whose loss is critical (weighted vault)", () => {
    // Alex 2, Sam 1, Jordan 1, high 3: losing Alex leaves 2 (< 3); losing Sam or Jordan leaves 3.
    const c = config({
      signers: signers([ALEX, 2], [SAM, 1], [JORDAN, 1]),
      thresholds: { low: 1, medium: 3, high: 3 },
    });
    const issue = validateVaultConfig(c).issues.find((i) => i.code === "N_MINUS_ONE");
    expect(issue?.signers).toEqual([ALEX]);
  });

  it("does not warn when every single loss is survivable", () => {
    expect(codes(config())).not.toContain("N_MINUS_ONE");
  });

  it("treats a 1-of-1 vault as critical", () => {
    const c = config({ signers: signers([ALEX, 1]), thresholds: { low: 1, medium: 1, high: 1 } });
    expect(codes(c)).toContain("N_MINUS_ONE");
  });
});

describe("rule 3: low ≤ medium ≤ high", () => {
  it.each([
    ["medium above high", { low: 1, medium: 3, high: 2 }],
    ["low above medium", { low: 3, medium: 2, high: 2 }],
  ])("rejects %s", (_name, thresholds) => {
    const result = validateVaultConfig(config({ thresholds }));
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("THRESHOLD_ORDER");
  });

  it("accepts equal thresholds", () => {
    expect(validateVaultConfig(config({ thresholds: { low: 2, medium: 2, high: 2 } })).valid).toBe(
      true,
    );
  });

  it("allows a low threshold of 0", () => {
    expect(validateVaultConfig(config({ thresholds: { low: 0, medium: 2, high: 2 } })).valid).toBe(
      true,
    );
  });
});

describe("rule 4: master key off only with other signers", () => {
  it("rejects turning off the master key with no other signers", () => {
    const result = validateVaultConfig(config({ signers: [], masterWeight: 0 }));
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toEqual(["NO_SIGNERS"]);
  });

  it("warns when the master key stays active", () => {
    const result = validateVaultConfig(
      config({ masterWeight: 1, thresholds: { low: 1, medium: 2, high: 2 } }),
    );
    const issue = result.issues.find((i) => i.code === "MASTER_KEY_ACTIVE");
    expect(issue).toMatchObject({ severity: "warning", signers: [MASTER_KEY] });
  });
});

describe("thresholds of zero", () => {
  it("rejects payments that need no approval", () => {
    const result = validateVaultConfig(config({ thresholds: { low: 0, medium: 0, high: 2 } }));
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("THRESHOLD_ZERO");
  });

  it("rejects signer changes that need no approval", () => {
    expect(codes(config({ thresholds: { low: 0, medium: 0, high: 0 } }))).toContain(
      "THRESHOLD_ZERO",
    );
  });
});

describe("a single signer able to pay alone", () => {
  it("warns and names that signer", () => {
    const c = config({
      signers: signers([ALEX, 2], [SAM, 1], [JORDAN, 1]),
      thresholds: { low: 1, medium: 2, high: 3 },
    });
    const issue = validateVaultConfig(c).issues.find((i) => i.code === "SINGLE_SIGNER_CAN_PAY");
    expect(issue).toMatchObject({ severity: "warning", signers: [ALEX] });
  });
});

describe("on-chain limits and input shape", () => {
  it("rejects invalid signer keys", () => {
    const bad = "GNOTAKEY";
    const secret = Keypair.random().secret();
    const result = validateVaultConfig(
      config({ signers: signers([ALEX, 1], [bad, 1], [secret, 1]) }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatchObject({ code: "INVALID_SIGNER_KEY", signers: [bad, secret] });
  });

  it("rejects duplicate signers", () => {
    const result = validateVaultConfig(
      config({ signers: signers([ALEX, 1], [ALEX, 1], [SAM, 1]) }),
    );
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "DUPLICATE_SIGNER", signers: [ALEX] }),
    ]);
  });

  it.each([0, -1, 1.5, 256, Number.NaN])("rejects signer weight %s", (weight) => {
    expect(codes(config({ signers: signers([ALEX, weight], [SAM, 1], [JORDAN, 1]) }))).toEqual([
      "INVALID_SIGNER_WEIGHT",
    ]);
  });

  it("accepts the maximum weight of 255", () => {
    const c = config({
      signers: signers([ALEX, 255], [SAM, 255]),
      thresholds: { low: 1, medium: 255, high: 255 },
    });
    expect(codes(c)).not.toContain("INVALID_SIGNER_WEIGHT");
  });

  it.each([-1, 256, 0.5])("rejects master weight %s", (masterWeight) => {
    expect(codes(config({ masterWeight }))).toEqual(["INVALID_MASTER_WEIGHT"]);
  });

  it.each([
    { low: -1, medium: 2, high: 2 },
    { low: 1, medium: 2.5, high: 3 },
    { low: 1, medium: 2, high: 256 },
  ])("rejects out-of-range thresholds %o", (thresholds) => {
    expect(codes(config({ thresholds }))).toEqual(["INVALID_THRESHOLD"]);
  });

  it("allows 20 signers and rejects 21", () => {
    const keys = Array.from({ length: 21 }, () => Keypair.random().publicKey());
    const of = (n: number) =>
      config({
        signers: keys.slice(0, n).map((key) => ({ key, weight: 1 })),
        thresholds: { low: 1, medium: 11, high: 11 },
      });
    expect(validateVaultConfig(of(20)).valid).toBe(true);
    expect(codes(of(21))).toEqual(["TOO_MANY_SIGNERS"]);
  });

  it("reports every shape error at once and skips weight rules", () => {
    const result = validateVaultConfig({
      signers: signers(["bad", 0], ["bad", 1]),
      thresholds: { low: 9, medium: 1, high: 300 },
      masterWeight: -1,
    });
    expect(result.issues.map((i) => i.code)).toEqual([
      "INVALID_SIGNER_KEY",
      "DUPLICATE_SIGNER",
      "INVALID_SIGNER_WEIGHT",
      "INVALID_MASTER_WEIGHT",
      "INVALID_THRESHOLD",
    ]);
  });
});

describe("activeSigners", () => {
  it("adds the master key only when its weight is above 0", () => {
    expect(activeSigners(config({ masterWeight: 0 })).map((s) => s.key)).toEqual([
      ALEX,
      SAM,
      JORDAN,
    ]);
    expect(activeSigners(config({ masterWeight: 2 })).at(-1)).toEqual({
      key: MASTER_KEY,
      weight: 2,
    });
  });
});
