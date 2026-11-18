import { describe, expect, it } from "vitest";

import { TESTNET } from "../network";
import { describeThresholds } from "../vault/describe";
import { validateVaultConfig } from "../vault/rules";
import { createHorizonClient } from "./client";

// Opt-in smoke test against the real Horizon testnet. Skipped unless a signer key is given:
//   HORIZON_LIVE_SIGNER=G... pnpm --filter @cosignly/shared test:live
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const signer = env?.HORIZON_LIVE_SIGNER;

describe.skipIf(!signer)("live Horizon testnet", () => {
  it("discovers the vaults this signer can approve for", async () => {
    const client = createHorizonClient({ network: TESTNET });
    const vaults = await client.discoverVaults(signer as string);
    expect(vaults.length).toBeGreaterThan(0);

    for (const vault of vaults) {
      const account = await client.getAccount(vault.accountId);
      const validation = validateVaultConfig(vault);
      console.info(
        [
          `vault ${vault.accountId}`,
          `  ${describeThresholds(vault).summary}`,
          `  signers: ${vault.signers.map((s) => `${s.key.slice(0, 4)}…${s.key.slice(-4)}(${s.weight})`).join(", ")}`,
          `  master weight: ${vault.masterWeight}`,
          `  balances: ${account?.balances.map((b) => `${b.balance} ${b.asset.type === "native" ? "XLM" : b.asset.code}`).join(", ")}`,
          `  issues: ${validation.issues.map((i) => i.code).join(", ") || "none"}`,
        ].join("\n"),
      );
      expect(vault.signers.some((s) => s.key === signer)).toBe(true);
    }
  }, 20_000);
});
