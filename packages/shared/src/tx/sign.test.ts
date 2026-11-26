import {
  FeeBumpTransaction,
  Keypair,
  TransactionBuilder,
  type Transaction,
} from "@stellar/stellar-sdk/base";
import { describe, expect, it } from "vitest";

import fx from "../coordinator/__fixtures__/refractor.json";
import { TESTNET } from "../network";
import { addSignatureToEnvelope } from "./sign";

// A real Refractor envelope carrying Alex's signature (2-of-2 testnet vault).
const withOne = fx.getPending.xdr;
const parse = (xdr: string) => TransactionBuilder.fromXDR(xdr, TESTNET.passphrase) as Transaction;

describe("addSignatureToEnvelope", () => {
  it("adds a signature and keeps the existing ones", () => {
    const base = parse(withOne);
    const extra = Keypair.random();
    const signed = parse(addSignatureToEnvelope(withOne, extra, TESTNET));
    expect(signed.signatures).toHaveLength(base.signatures.length + 1);
    const last = signed.signatures.at(-1)?.signature;
    expect(last && extra.verify(signed.hash(), last)).toBe(true);
    // Same transaction: the hash doesn't change when signatures are added.
    expect(signed.hash()).toEqual(base.hash());
  });

  it("refuses fee-bump envelopes", () => {
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      Keypair.random(),
      "2000",
      parse(withOne),
      TESTNET.passphrase,
    );
    expect(feeBump).toBeInstanceOf(FeeBumpTransaction);
    expect(() => addSignatureToEnvelope(feeBump.toXDR(), Keypair.random(), TESTNET)).toThrow(
      /Fee-bump/,
    );
  });
});
