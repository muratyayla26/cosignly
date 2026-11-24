import type { FeeBumpTransaction } from "@stellar/stellar-sdk/base";
import {
  Account,
  Asset,
  Keypair,
  Memo,
  Operation,
  TransactionBuilder,
  type xdr,
} from "@stellar/stellar-sdk/base";
import { describe, expect, it } from "vitest";

import { getUsdc } from "../assets";
import { TESTNET } from "../network";
import setupTransaction from "../vault/__fixtures__/setup-transaction.json";
import fixtures from "./__fixtures__/transactions.json";
import { decodeTransaction, type DecodeContext, type DecodedTransaction } from "./decode";

// Real testnet transactions (created 2026-11-22, see __fixtures__/transactions.json).
const { alex: ALEX, sam: SAM, newAccount: NEW } = fixtures.accounts;
const USDC = getUsdc("testnet");
const context: DecodeContext = {
  network: TESTNET,
  usdc: USDC,
  labels: { [ALEX]: "Team Vault", [SAM]: "Sam" },
};

function fixture(id: string) {
  const found = fixtures.transactions.find((t) => t.id === id);
  if (!found) throw new Error(`no fixture ${id}`);
  return found;
}

function decode(xdrOrId: string, ctx: DecodeContext = context): DecodedTransaction {
  const envelope = xdrOrId.startsWith("AAAA") ? xdrOrId : fixture(xdrOrId).envelope_xdr;
  const result = decodeTransaction(envelope, ctx);
  if (!result.ok) throw new Error(result.error);
  return result.tx;
}

describe("real testnet fixtures", () => {
  it.each(fixtures.transactions.map((t) => [t.id, t] as const))(
    "%s: hash matches the network's",
    (_id, t) => {
      expect(decode(t.envelope_xdr).hash).toBe(t.hash);
    },
  );

  it("XLM payment with a text memo and a 7-day window", () => {
    const tx = decode("payment-xlm");
    expect(tx.title).toBe("Send 25.5 XLM to Sam");
    expect(tx.source).toBe(ALEX);
    expect(tx.memo).toEqual({ type: "text", value: "Rent March" });
    expect(tx.validFrom).toBeUndefined();
    const days =
      ((tx.validUntil?.getTime() ?? 0) - Date.parse("2026-11-22T20:20:24Z")) / 86_400_000;
    expect(days).toBeCloseTo(7, 1);
    expect(tx.maxFee).toBe("0.0001000");
    expect(tx.warnings).toEqual([]);
    expect(tx.operations[0]).toMatchObject({
      kind: "payment",
      destination: SAM,
      amount: "25.5000000",
      asset: { code: "XLM", known: true },
      flags: [],
    });
  });

  it("USDC payment (signed, not submitted)", () => {
    const tx = decode("payment-usdc-unsubmitted");
    expect(tx.title).toBe("Send 500 USDC to Sam");
    expect(tx.operations[0]).toMatchObject({
      asset: { code: "USDC", issuer: USDC.type === "credit" ? USDC.issuer : "", known: true },
    });
    expect(tx.warnings).toEqual([]);
  });

  it("create_account", () => {
    expect(decode("create-account").title).toBe("Create the account GDQF…BF43 with 5 XLM");
    expect(decode("create-account").operations[0]).toMatchObject({
      kind: "create_account",
      destination: NEW,
      startingBalance: "5.0000000",
    });
  });

  it("change_trust: add and remove", () => {
    expect(decode("change-trust-add").operations[0]).toMatchObject({
      kind: "change_trust",
      text: "Start accepting USDC",
      removes: false,
    });
    expect(decode("change-trust-remove").operations[0]).toMatchObject({
      text: "Stop accepting USDC",
      removes: true,
      limit: "0.0000000",
    });
  });

  it("set_options: add a signer, then remove it", () => {
    const add = decode("set-options-add-signer");
    expect(add.title).toBe("Change signers and approval rules");
    expect(add.operations.map((op) => op.text)).toEqual([
      "Add Sam as a signer (weight 1)",
      "Payments need weight 2, changing signers needs weight 2, minor actions need weight 1",
    ]);
    expect(decode("set-options-remove-signer").operations[0]?.text).toBe("Remove Sam as a signer");
  });

  it("uses current signers to tell a weight change from a new signer", () => {
    const tx = decode("set-options-add-signer", {
      ...context,
      currentSigners: [{ key: SAM, weight: 3 }],
    });
    expect(tx.operations[0]?.text).toBe("Change Sam's weight from 3 to 1");
  });

  it("flags an operation Cosignly doesn't read, in plain language", () => {
    const tx = decode("mixed-unknown");
    expect(tx.title).toBe("2 actions");
    expect(tx.memo).toEqual({ type: "id", value: "42" });
    expect(tx.operations.map((op) => [op.kind, op.text, op.flags])).toEqual([
      ["payment", "Send 1 XLM to Sam", []],
      ["unknown", "Unrecognized action: manage data", ["unknown"]],
    ]);
    expect(tx.warnings).toEqual([
      "This transaction includes an action Cosignly can't read (manage data). Only approve it if you know exactly what it does.",
    ]);
  });

  it("the vault setup transaction from W2.2", () => {
    const tx = decode(setupTransaction.envelope_xdr);
    expect(tx.title).toBe("5 actions");
    expect(tx.operations.map((op) => op.lines)).toEqual([
      [],
      ["Add GCFA…ORJ7 as a signer (weight 1)"],
      ["Add GDGK…T4CY as a signer (weight 1)"],
      ["Add GDCH…TXR5 as a signer (weight 1)"],
      [
        "Turn off the account's own key",
        "Payments need weight 2, changing signers needs weight 2, minor actions need weight 2",
      ],
    ]);
    expect(tx.operations[4]?.text).toBe("Change the account settings");
    expect(tx.warnings).toEqual([]);
  });
});

/** Builds (not submits) a transaction from Alex for cases that can't be made safely on-chain. */
function build(ops: xdr.Operation[], memo?: Memo, timeout = 300): string {
  const builder = new TransactionBuilder(new Account(ALEX, "1"), {
    fee: "100",
    networkPassphrase: TESTNET.passphrase,
  });
  for (const op of ops) builder.addOperation(op);
  if (memo) builder.addMemo(memo);
  return builder.setTimeout(timeout).build().toXDR();
}

describe("flags", () => {
  it("fake USDC from another issuer is called out", () => {
    const fakeIssuer = Keypair.random().publicKey();
    const tx = decode(
      build([
        Operation.payment({
          destination: SAM,
          asset: new Asset("USDC", fakeIssuer),
          amount: "500",
        }),
      ]),
    );
    expect(tx.operations[0]?.flags).toEqual(["unverified-asset"]);
    expect(tx.warnings[0]).toMatch(/not by Circle\. It is not real USDC\.$/);
  });

  it("other assets are named but flagged", () => {
    const tx = decode(
      build([Operation.changeTrust({ asset: new Asset("ABC", SAM), limit: "1000" })]),
    );
    expect(tx.operations[0]).toMatchObject({
      text: "Accept up to 1,000 ABC",
      flags: ["unverified-asset"],
    });
    expect(tx.warnings[0]).toBe(
      "ABC is issued by Sam. Cosignly only recognizes XLM and USDC.".replace("Sam", "GCBZ…S235"),
    );
  });

  it("an operation on another account is flagged", () => {
    const tx = decode(
      build([
        Operation.payment({ destination: ALEX, asset: Asset.native(), amount: "1", source: SAM }),
      ]),
    );
    expect(tx.operations[0]).toMatchObject({ source: SAM, flags: ["other-account"] });
    expect(tx.warnings).toEqual(["An action uses another account (Sam), not this vault."]);
  });

  it("risky account settings", () => {
    const tx = decode(
      build([
        Operation.setOptions({ masterWeight: 1 }),
        Operation.setOptions({ setFlags: 1 }),
        Operation.setOptions({ inflationDest: SAM }),
        Operation.setOptions({ signer: { sha256Hash: "a".repeat(64), weight: 1 } }),
        Operation.setOptions({ homeDomain: "example.com" }),
        Operation.setOptions({ homeDomain: "" }),
        Operation.setOptions({}),
      ]),
    );
    expect(tx.operations.map((op) => [op.text, op.flags])).toEqual([
      ["Let the account's own key sign (weight 1)", ["risky"]],
      ["Change the account's asset authorization flags", ["risky"]],
      ["Set the inflation destination to Sam", ["risky"]],
      ["Add a special signer Cosignly can't use", ["risky"]],
      ["Set the home domain to example.com", []],
      ["Clear the home domain", []],
      ["No changes to the account settings", []],
    ]);
    expect(tx.title).toBe("7 actions");
    // One warning per kind of problem.
    expect(tx.warnings).toEqual([
      "This changes account settings that can weaken or lock the vault.",
    ]);
  });

  it("lists every unknown operation type", () => {
    const tx = decode(
      build([
        Operation.bumpSequence({ bumpTo: "100" }),
        Operation.accountMerge({ destination: SAM }),
      ]),
    );
    expect(tx.operations.map((op) => op.text)).toEqual([
      "Unrecognized action: bump sequence",
      "Unrecognized action: account merge",
    ]);
    expect(tx.warnings).toHaveLength(2);
  });
});

describe("envelope details", () => {
  it("several payments get a counted title; hash and return memos are hex", () => {
    const pay = (amount: string) =>
      Operation.payment({ destination: SAM, asset: Asset.native(), amount });
    const hashMemo = Memo.hash("ab".repeat(32));
    const tx = decode(build([pay("1"), pay("2")], hashMemo));
    expect(tx.title).toBe("2 payments");
    expect(tx.memo).toEqual({ type: "hash", value: "ab".repeat(32) });
  });

  it("no expiry when the transaction has no max time", () => {
    const tx = decode(build([Operation.bumpSequence({ bumpTo: "5" })], undefined, 0));
    expect(tx.validUntil).toBeUndefined();
  });

  it("rejects garbage, other networks and fee-bump envelopes", () => {
    expect(decodeTransaction("not xdr", context)).toEqual({ ok: false, error: "invalid" });

    const inner = TransactionBuilder.fromXDR(
      fixture("payment-xlm").envelope_xdr,
      TESTNET.passphrase,
    );
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      Keypair.random(),
      "2000",
      inner as Exclude<typeof inner, FeeBumpTransaction>,
      TESTNET.passphrase,
    );
    expect(decodeTransaction(feeBump.toXDR(), context)).toEqual({ ok: false, error: "fee-bump" });
  });
});
