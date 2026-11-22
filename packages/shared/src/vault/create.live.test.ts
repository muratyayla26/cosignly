import { describe, expect, it } from "vitest";

import { getUsdc } from "../assets";
import { createHorizonClient } from "../horizon/client";
import { TESTNET } from "../network";
import { startVaultCreation } from "./create";
import { equalWeightConfig } from "./setup";

// Opt-in: creates a real 2-of-3 vault on testnet (Friendbot + one transaction).
//   VAULT_LIVE_CREATE=1 pnpm --filter @cosignly/shared test:live
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

// Real testnet signer keys (see horizon/__fixtures__): Alex, Sam, Jordan.
const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const SAM = "GDGKPPMM5BORTIJLY2IC2OCU33OACYDRHMOUJAFRXHY4GTYOJD2QT4CY";
const JORDAN = "GDCHQZAQROW52J3O7WJUTFQMCB6HB7TJXVV33LPJS5PIHG3X5H55TXR5";

describe.skipIf(!env?.VAULT_LIVE_CREATE)("live vault creation (testnet)", () => {
  it("creates a 2-of-3 vault in one transaction", async () => {
    const horizon = createHorizonClient({ network: TESTNET });
    const config = equalWeightConfig([ALEX, SAM, JORDAN], 2, 2);
    const creation = startVaultCreation({
      config,
      usdc: getUsdc("testnet"),
      network: TESTNET,
      horizon,
    });
    const steps: string[] = [];
    const result = await creation.run((s) => steps.push(s));

    console.info(`vault ${result.accountId}\ntx ${result.txHash ?? "(unknown)"}`);
    expect(steps).toEqual(["fund", "configure", "verify"]);
    expect(result.account.masterWeight).toBe(0);
    expect(result.account.subentryCount).toBe(4); // 3 signers + USDC trustline

    const vaults = await horizon.discoverVaults(SAM);
    expect(vaults.some((v) => v.accountId === result.accountId)).toBe(true);
  }, 60_000);
});
