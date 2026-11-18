import { describe, expect, it } from "vitest";

import { describeRequirement, describeThresholds } from "./describe";
import type { VaultConfig } from "./types";

const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const SAM = "GDGKPPMM5BORTIJLY2IC2OCU33OACYDRHMOUJAFRXHY4GTYOJD2QT4CY";
const JORDAN = "GDCHQZAQROW52J3O7WJUTFQMCB6HB7TJXVV33LPJS5PIHG3X5H55TXR5";

const vault = (weights: number[], medium: number, high: number, masterWeight = 0): VaultConfig => ({
  signers: [ALEX, SAM, JORDAN]
    .slice(0, weights.length)
    .map((key, i) => ({ key, weight: weights[i] ?? 0 })),
  thresholds: { low: 1, medium, high },
  masterWeight,
});

describe("describeThresholds", () => {
  it("describes a 2-of-3 vault", () => {
    expect(describeThresholds(vault([1, 1, 1], 2, 2)).summary).toBe(
      "Payments need 2 of 3. Changing signers needs 2 of 3.",
    );
  });

  it("describes different payment and admin thresholds", () => {
    const d = describeThresholds(vault([1, 1, 1], 2, 3));
    expect(d.payments.phrase).toBe("2 of 3");
    expect(d.admin.phrase).toBe("3 of 3");
  });

  it("handles equal weights above 1", () => {
    expect(describeThresholds(vault([2, 2, 2], 3, 4)).summary).toBe(
      "Payments need 2 of 3. Changing signers needs 2 of 3.",
    );
  });

  it("describes weighted vaults with weight and the fewest signers needed", () => {
    const d = describeThresholds(vault([2, 1, 1], 2, 3));
    expect(d.payments).toEqual({
      minSigners: 1,
      totalSigners: 3,
      equalWeights: false,
      phrase: "a combined weight of 2 of 4",
    });
    expect(d.admin.minSigners).toBe(2);
  });

  it("counts an active master key as a signer", () => {
    expect(describeThresholds(vault([1, 1], 2, 2, 1)).payments.phrase).toBe("2 of 3");
  });

  it("says when a threshold cannot be reached", () => {
    const d = describeThresholds(vault([1, 1], 2, 3));
    expect(d.admin.minSigners).toBeNull();
    expect(d.admin.phrase).toBe("more approval weight than the signers have");
  });
});

describe("describeRequirement", () => {
  it("treats a threshold of 0 as needing one signature", () => {
    expect(describeRequirement([{ key: ALEX, weight: 1 }], 0).minSigners).toBe(1);
  });

  it("returns null when there are no signers", () => {
    expect(describeRequirement([], 1).minSigners).toBeNull();
  });
});
