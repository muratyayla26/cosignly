import { describe, expect, it } from "vitest";

import { toAccountInfo, type AccountInfo } from "../horizon/client";
import type { HorizonAccount } from "../horizon/types";
import vaultAccount from "../horizon/__fixtures__/vault-account.json";
import { xlmReserve } from "./reserve";

const account = (patch: Partial<AccountInfo>): AccountInfo => ({
  ...toAccountInfo(vaultAccount as HorizonAccount),
  ...patch,
});

describe("xlmReserve", () => {
  it("charges 0.5 XLM per signer and trustline on top of the 1 XLM base (real 2-of-3 vault)", () => {
    // 3 signers + 1 USDC trustline = 4 subentries → (2 + 4) × 0.5 = 3 XLM
    const reserve = xlmReserve(toAccountInfo(vaultAccount as HorizonAccount));
    expect(reserve.minimumBalance).toBe("3.0000000");
    expect(reserve.available).toBe("9996.9999500");
  });

  it("accounts for sponsorship and offer liabilities", () => {
    const reserve = xlmReserve(
      account({
        subentryCount: 4,
        numSponsoring: 1,
        numSponsored: 2,
        balances: [{ asset: { type: "native" }, balance: "10", sellingLiabilities: "1.5" }],
      }),
    );
    expect(reserve.minimumBalance).toBe("2.5000000"); // (2 + 4 + 1 − 2) × 0.5
    expect(reserve.available).toBe("6.0000000");
  });

  it("never reports a negative available amount", () => {
    const reserve = xlmReserve(
      account({ balances: [{ asset: { type: "native" }, balance: "1.0000000" }] }),
    );
    expect(reserve.available).toBe("0.0000000");
  });

  it("treats a missing XLM balance as zero", () => {
    expect(xlmReserve(account({ balances: [] })).available).toBe("0.0000000");
  });
});
