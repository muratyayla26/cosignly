import { activeSigners, sumWeights } from "./rules";
import type { VaultConfig, VaultSigner } from "./types";

export interface ThresholdRequirement {
  /** Fewest signers that can reach the threshold together, or `null` if impossible. */
  minSigners: number | null;
  /** Number of signers that count towards thresholds. */
  totalSigners: number;
  /** `true` when every signer has the same weight, so "N of M" is exact. */
  equalWeights: boolean;
  /** Plain-language phrase, e.g. "2 of 3". */
  phrase: string;
}

export interface ThresholdDescription {
  payments: ThresholdRequirement;
  admin: ThresholdRequirement;
  /** e.g. "Payments need 2 of 3. Changing signers needs 2 of 3." */
  summary: string;
}

/**
 * Turns a vault's weights and thresholds into plain language for the UI.
 * Payments use the medium threshold; signer changes use the high threshold.
 */
export function describeThresholds(config: VaultConfig): ThresholdDescription {
  const signers = activeSigners(config);
  const payments = describeRequirement(signers, config.thresholds.medium);
  const admin = describeRequirement(signers, config.thresholds.high);
  return {
    payments,
    admin,
    summary: `Payments need ${payments.phrase}. Changing signers needs ${admin.phrase}.`,
  };
}

export function describeRequirement(
  signers: readonly VaultSigner[],
  threshold: number,
): ThresholdRequirement {
  const totalSigners = signers.length;
  const equalWeights = signers.every((s) => s.weight === signers[0]?.weight);
  const minSigners = minSignersFor(signers, threshold);

  let phrase: string;
  if (minSigners === null) {
    phrase = "more approval weight than the signers have";
  } else if (equalWeights) {
    phrase = `${minSigners} of ${totalSigners}`;
  } else {
    phrase = `a combined weight of ${threshold} of ${sumWeights(signers)}`;
  }

  return { minSigners, totalSigners, equalWeights, phrase };
}

/** Fewest signers whose weights add up to `threshold` (heaviest first). */
function minSignersFor(signers: readonly VaultSigner[], threshold: number): number | null {
  // Even at threshold 0 an operation needs a signature from a key with weight > 0
  // (weight-0 keys cannot sign at all), so treat 0 as 1.
  const target = Math.max(threshold, 1);
  const weights = signers.map((s) => s.weight).sort((a, b) => b - a);
  let sum = 0;
  for (const [i, w] of weights.entries()) {
    sum += w;
    if (sum >= target) return i + 1;
  }
  return null;
}
