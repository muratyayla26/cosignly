import { describe, expect, it } from "vitest";

import { describeOperation } from "./activity";
import type { HorizonOperation, HorizonPage } from "./types";
// Real operations of the CLI-created 2-of-3 vault (horizon-testnet, 2026-11-19), newest first.
import operations from "./__fixtures__/vault-operations.json";

const VAULT = "GDDTBEBLVLD32OEMRUEXH7KEHYK5VRVN6ZXAJF7NIWMUG3ATUGTCNLOL";
const JORDAN = "GDCHQZAQROW52J3O7WJUTFQMCB6HB7TJXVV33LPJS5PIHG3X5H55TXR5";
const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const FRIENDBOT = "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR";

const records = (operations as HorizonPage<HorizonOperation>)._embedded.records;
const op = (patch: Partial<HorizonOperation>): HorizonOperation => ({
  id: "1",
  paging_token: "1",
  transaction_successful: true,
  source_account: VAULT,
  type: "payment",
  created_at: "2026-11-19T10:00:00Z",
  transaction_hash: "abc",
  ...patch,
});

describe("describeOperation (real vault history)", () => {
  const activity = records.map((r) => describeOperation(VAULT, r));

  it("tells the vault's story in plain language, newest first", () => {
    expect(activity.map((a) => a.title)).toEqual([
      "Received 25 XLM",
      "Changed the approval rules",
      "Started accepting USDC",
      "Added or updated a signer",
      "Added or updated a signer",
      "Added or updated a signer",
      "Vault opened with 10,000 XLM",
    ]);
  });

  it("keeps the counterparty, time and transaction hash", () => {
    expect(activity[0]).toMatchObject({
      kind: "received",
      counterparty: JORDAN,
      transactionHash: "b42d973f262bf08e85b72e96076a0b268b0a86ef59958f6daa029a02455984b7",
    });
    expect(activity[0]?.createdAt).toBeInstanceOf(Date);
    expect(activity[5]).toMatchObject({ kind: "signers-changed", counterparty: ALEX });
    expect(activity[6]).toMatchObject({ kind: "created", counterparty: FRIENDBOT });
  });
});

describe("describeOperation (other cases)", () => {
  it("describes an outgoing USDC payment", () => {
    const a = describeOperation(
      VAULT,
      op({
        from: VAULT,
        to: ALEX,
        amount: "500.0000000",
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
      }),
    );
    expect(a).toMatchObject({ kind: "sent", title: "Sent 500 USDC", counterparty: ALEX });
  });

  it("treats path payments like payments", () => {
    const a = describeOperation(
      VAULT,
      op({
        type: "path_payment_strict_send",
        from: ALEX,
        to: VAULT,
        amount: "1.5",
        asset_type: "native",
      }),
    );
    expect(a).toMatchObject({ kind: "received", title: "Received 1.5 XLM" });
  });

  it("flags a payment that does not involve the vault", () => {
    expect(describeOperation(VAULT, op({ from: ALEX, to: JORDAN })).kind).toBe("other");
  });

  it("describes funding a new account from the vault", () => {
    const a = describeOperation(
      VAULT,
      op({ type: "create_account", funder: VAULT, account: ALEX, starting_balance: "2.0000000" }),
    );
    expect(a).toMatchObject({ kind: "sent", title: "Sent 2 XLM to open a new account" });
  });

  it("describes removing a trustline and a signer", () => {
    expect(
      describeOperation(VAULT, op({ type: "change_trust", limit: "0.0000000", asset_code: "USDC" }))
        .title,
    ).toBe("Stopped accepting USDC");
    expect(
      describeOperation(VAULT, op({ type: "set_options", signer_key: ALEX, signer_weight: 0 }))
        .title,
    ).toBe("Removed a signer");
  });

  it("describes other settings, merges and unknown operations", () => {
    expect(describeOperation(VAULT, op({ type: "set_options" })).title).toBe(
      "Changed account settings",
    );
    expect(describeOperation(VAULT, op({ type: "account_merge", into: ALEX })).kind).toBe("merged");
    expect(describeOperation(VAULT, op({ type: "manage_sell_offer" }))).toMatchObject({
      kind: "other",
      title: "Other activity",
    });
  });
});
