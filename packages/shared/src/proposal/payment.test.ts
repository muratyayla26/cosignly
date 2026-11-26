import { Keypair } from "@stellar/stellar-sdk/base";
import { describe, expect, it } from "vitest";

import { getUsdc } from "../assets";
import { toAccountInfo, type AccountInfo } from "../horizon/client";
import vaultAccountFixture from "../horizon/__fixtures__/vault-account.json";
import type { HorizonAccount } from "../horizon/types";
import { TESTNET } from "../network";
import { decodeTransaction } from "../tx/decode";
import setupAccount from "../vault/__fixtures__/setup-account.json";
import {
  approvalProgress,
  availableToSend,
  buildPaymentProposal,
  checkPaymentDraft,
  type PaymentDraft,
} from "./payment";

// Real testnet accounts: the W2.2 2-of-3 vault (≈10,000 XLM, USDC trustline, 0 USDC)
// and the W1.2 CLI vault (also has a USDC trustline).
const USDC = getUsdc("testnet");
const vault = toAccountInfo(setupAccount as HorizonAccount);
const recipient = toAccountInfo(vaultAccountFixture as HorizonAccount);
const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const SAM = "GDGKPPMM5BORTIJLY2IC2OCU33OACYDRHMOUJAFRXHY4GTYOJD2QT4CY";
const JORDAN = "GDCHQZAQROW52J3O7WJUTFQMCB6HB7TJXVV33LPJS5PIHG3X5H55TXR5";

const draft = (overrides: Partial<PaymentDraft> = {}): PaymentDraft => ({
  asset: "XLM",
  destination: recipient.id,
  amount: "25",
  memo: "",
  ...overrides,
});

const issues = (d: PaymentDraft, r: AccountInfo | null | undefined = recipient, v = vault) =>
  checkPaymentDraft(d, { vault: v, recipient: r, usdc: USDC }).map((i) => [i.field, i.message]);

const withUsdc = (account: AccountInfo, balance: string, limit = "922337203685.4775807") => ({
  ...account,
  balances: [
    ...account.balances.filter((b) => b.asset.type === "native"),
    { asset: USDC, balance, limit },
  ],
});

describe("checkPaymentDraft", () => {
  it("accepts a valid XLM payment", () => {
    expect(issues(draft())).toEqual([]);
    expect(issues(draft({ destination: ` ${recipient.id.toLowerCase()} ` }))).toEqual([]);
  });

  it("checks the recipient address", () => {
    expect(issues(draft({ destination: "" }))).toEqual([
      ["destination", "Enter the recipient's Stellar address."],
    ]);
    expect(issues(draft({ destination: "GABC" }))[0]?.[1]).toMatch(/not a valid Stellar address/);
    expect(issues(draft({ destination: Keypair.random().secret() }))[0]?.[1]).toMatch(
      /This is a secret key/,
    );
    expect(issues(draft({ destination: vault.id }))).toEqual([
      ["destination", "This is the vault's own address."],
    ]);
  });

  it("the recipient must exist", () => {
    expect(issues(draft(), null)).toEqual([
      [
        "destination",
        "This account doesn't exist on Stellar yet. Payments can only go to existing accounts.",
      ],
    ]);
    // Not looked up yet: only the format is checked.
    expect(issues(draft(), undefined)).toEqual([]);
  });

  it("USDC needs a recipient trustline with room, and a vault balance", () => {
    const noTrust = {
      ...recipient,
      balances: recipient.balances.filter((b) => b.asset.type === "native"),
    };
    expect(issues(draft({ asset: "USDC", amount: "1" }), noTrust, withUsdc(vault, "10"))).toEqual([
      [
        "destination",
        "The recipient can't receive USDC yet. They need to add USDC to their account first.",
      ],
    ]);
    expect(
      issues(
        draft({ asset: "USDC", amount: "5" }),
        withUsdc(recipient, "8", "10"),
        withUsdc(vault, "10"),
      ),
    ).toEqual([["amount", "The recipient can receive at most 2 USDC more."]]);
    expect(issues(draft({ asset: "USDC", amount: "500" }), withUsdc(recipient, "0"))).toEqual([
      ["amount", "The vault can send at most 0 USDC."],
    ]);
    expect(
      issues(
        draft({ asset: "USDC", amount: "500" }),
        withUsdc(recipient, "0"),
        withUsdc(vault, "500"),
      ),
    ).toEqual([]);
  });

  it("the vault must hold the asset", () => {
    const xlmOnly = { ...vault, balances: vault.balances.filter((b) => b.asset.type === "native") };
    expect(
      issues(draft({ asset: "USDC", amount: "1" }), withUsdc(recipient, "0"), xlmOnly),
    ).toEqual([["asset", "This vault can't hold USDC."]]);
  });

  it("checks the amount against what the vault can send", () => {
    for (const amount of ["", "0", "-1", "1.12345678", "abc", "1,5"]) {
      expect(issues(draft({ amount }))).toEqual([
        ["amount", "Enter an amount greater than 0, with up to 7 decimal places."],
      ]);
    }
    // 9,999.99995 XLM − 3 XLM minimum balance − 0.0001 XLM max fee.
    expect(availableToSend(vault, { type: "native" })).toBe("9996.9998500");
    expect(issues(draft({ amount: "9996.99985" }))).toEqual([]);
    expect(issues(draft({ amount: "9996.9998501" }))).toEqual([
      ["amount", "The vault can send at most 9,996.99985 XLM."],
    ]);
  });

  it("text memos are limited to 28 bytes", () => {
    expect(issues(draft({ memo: "x".repeat(28) }))).toEqual([]);
    expect(issues(draft({ memo: "ü".repeat(15) }))).toEqual([
      ["memo", "The note can be at most 28 characters."],
    ]);
  });
});

describe("buildPaymentProposal", () => {
  const now = new Date("2026-11-24T12:00:00Z");

  it("one payment on the vault's next sequence number, valid for 7 days", () => {
    const tx = buildPaymentProposal({
      vault,
      draft: draft({ memo: "Rent March" }),
      usdc: USDC,
      network: TESTNET,
      now,
    });
    expect(tx.source).toBe(vault.id);
    expect(tx.sequence).toBe((BigInt(vault.sequence) + 1n).toString());
    expect(tx.timeBounds).toEqual({ minTime: "0", maxTime: String(now.getTime() / 1000 + 604800) });
    expect(tx.signatures).toHaveLength(0);

    const decoded = decodeTransaction(tx.toXDR(), {
      network: TESTNET,
      usdc: USDC,
      labels: { [recipient.id]: "Sam" },
    });
    expect(decoded.ok && decoded.tx).toMatchObject({
      title: "Send 25 XLM to Sam",
      memo: { type: "text", value: "Rent March" },
      warnings: [],
    });
  });

  it("USDC uses Cosignly's USDC issuer", () => {
    const tx = buildPaymentProposal({
      vault: withUsdc(vault, "600"),
      draft: draft({ asset: "USDC", amount: "500" }),
      usdc: USDC,
      network: TESTNET,
      now,
    });
    const decoded = decodeTransaction(tx.toXDR(), { network: TESTNET, usdc: USDC });
    expect(decoded.ok && decoded.tx.operations[0]).toMatchObject({
      asset: { code: "USDC", known: true },
    });
    expect(decoded.ok && decoded.tx.memo).toBeUndefined();
  });

  it("refuses an invalid draft", () => {
    expect(() =>
      buildPaymentProposal({ vault, draft: draft({ amount: "0" }), usdc: USDC, network: TESTNET }),
    ).toThrow(/greater than 0/);
    expect(() =>
      buildPaymentProposal({ vault, draft: draft(), usdc: { type: "native" }, network: TESTNET }),
    ).toThrow(/issued asset/);
  });
});

describe("approvalProgress", () => {
  const twoOfThree = {
    signers: [ALEX, SAM, JORDAN].map((key) => ({ key, weight: 1 })),
    thresholds: { low: 2, medium: 2, high: 2 },
    masterWeight: 0,
  };

  it("counts signers when weights are equal; ignores keys that aren't signers", () => {
    expect(approvalProgress(twoOfThree, [ALEX, Keypair.random().publicKey()])).toEqual({
      approvedBy: [ALEX],
      approvals: 1,
      required: 2,
      countsSigners: true,
      complete: false,
    });
    expect(approvalProgress(twoOfThree, [ALEX, SAM]).complete).toBe(true);
  });

  it("counts weight when weights differ", () => {
    const weighted = {
      ...twoOfThree,
      signers: [
        { key: ALEX, weight: 2 },
        { key: SAM, weight: 1 },
        { key: JORDAN, weight: 1 },
      ],
      thresholds: { low: 3, medium: 3, high: 3 },
    };
    expect(approvalProgress(weighted, [ALEX])).toMatchObject({
      approvals: 2,
      required: 3,
      countsSigners: false,
      complete: false,
    });
    expect(approvalProgress(weighted, [ALEX, JORDAN]).complete).toBe(true);
  });
});
