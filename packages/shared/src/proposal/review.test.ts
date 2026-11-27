import { describe, expect, it, vi } from "vitest";

import type { CoordinatorStatus } from "../coordinator/types";
import { equalWeightConfig } from "../vault/setup";
import { reviewProposal, settleWithLedger, type ProposalReviewInput } from "./review";

const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const SAM = "GDGKPPMM5BORTIJLY2IC2OCU33OACYDRHMOUJAFRXHY4GTYOJD2QT4CY";
const JORDAN = "GDCHQZAQROW52J3O7WJUTFQMCB6HB7TJXVV33LPJS5PIHG3X5H55TXR5";
const STRANGER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

const status = (overrides: Partial<CoordinatorStatus> = {}): CoordinatorStatus => ({
  network: "testnet",
  hash: "ab".repeat(32),
  state: "collecting",
  xdr: "",
  signedBy: [ALEX],
  ...overrides,
});

const input = (overrides: Partial<ProposalReviewInput> = {}): ProposalReviewInput => ({
  vault: equalWeightConfig([ALEX, SAM, JORDAN], 2, 2),
  vaultSequence: "100",
  txSequence: "101",
  status: status(),
  signer: SAM,
  ...overrides,
});

describe("reviewProposal", () => {
  it("a signer who hasn't approved can approve", () => {
    expect(reviewProposal(input())).toMatchObject({
      phase: "collecting",
      canApprove: true,
      isSigner: true,
      hasSigned: false,
      progress: { approvals: 1, required: 2 },
    });
  });

  it("the proposer (already signed) can't sign again", () => {
    expect(reviewProposal(input({ signer: ALEX }))).toMatchObject({
      canApprove: false,
      reason: "You approved this payment.",
    });
  });

  it("a key that isn't a signer can't approve", () => {
    expect(reviewProposal(input({ signer: STRANGER }))).toMatchObject({
      canApprove: false,
      isSigner: false,
      reason: "Your key isn't a signer of this vault, so you can't approve.",
    });
  });

  it("never adds a signature once the threshold is met (tx_bad_auth_extra)", () => {
    // Refractor may still say "pending" for a moment after the last signature.
    const met = reviewProposal(
      input({ signer: JORDAN, status: status({ signedBy: [ALEX, SAM] }) }),
    );
    expect(met).toMatchObject({ phase: "sending", canApprove: false });
    expect(
      reviewProposal(
        input({ signer: JORDAN, status: status({ state: "ready", signedBy: [ALEX, SAM] }) }),
      ),
    ).toMatchObject({ phase: "sending", canApprove: false });
  });

  it("maps finished states", () => {
    expect(reviewProposal(input({ status: status({ state: "submitted" }) })).phase).toBe(
      "executed",
    );
    expect(reviewProposal(input({ status: status({ state: "failed" }) })).phase).toBe("failed");
    expect(reviewProposal(input({ status: status({ state: "expired" }) })).phase).toBe("expired");
    for (const state of ["submitted", "failed", "expired"] as const) {
      expect(reviewProposal(input({ status: status({ state }) })).canApprove).toBe(false);
    }
  });

  it("is stale once the vault used the sequence number for another transaction", () => {
    expect(reviewProposal(input({ vaultSequence: "101" }))).toMatchObject({
      phase: "stale",
      canApprove: false,
    });
    // After it executed, the sequence moving on is expected, not stale.
    expect(
      reviewProposal(input({ vaultSequence: "101", status: status({ state: "submitted" }) })).phase,
    ).toBe("executed");
  });
});

describe("settleWithLedger", () => {
  const ledger = (found: { successful: boolean } | null) => ({
    getTransaction: vi.fn(async (hash: string) => (found ? { hash, ledger: 1, ...found } : null)),
  });

  it("Refractor still says processing, but the payment is on the ledger → executed, not stale", async () => {
    // Observed on testnet: the vault's sequence moves on ~seconds before Refractor says processed.
    const horizon = ledger({ successful: true });
    const lagging = status({ state: "ready", signedBy: [ALEX, SAM] });
    const settled = await settleWithLedger(lagging, "101", "101", horizon);
    expect(settled.state).toBe("submitted");
    expect(horizon.getTransaction).toHaveBeenCalledWith(lagging.hash);
    expect(reviewProposal(input({ vaultSequence: "101", status: settled })).phase).toBe("executed");
  });

  it("not on the ledger → another transaction went first (stale)", async () => {
    const settled = await settleWithLedger(status(), "101", "101", ledger(null));
    expect(reviewProposal(input({ vaultSequence: "101", status: settled })).phase).toBe("stale");
  });

  it("applied but its operations failed → failed", async () => {
    const settled = await settleWithLedger(
      status({ state: "ready" }),
      "101",
      "101",
      ledger({ successful: false }),
    );
    expect(settled).toMatchObject({
      state: "failed",
      error: "The payment's operations failed on Stellar.",
    });
  });

  it("doesn't ask Horizon when the sequence is unused or the state is final", async () => {
    const horizon = ledger({ successful: true });
    expect(await settleWithLedger(status(), "100", "101", horizon)).toEqual(status());
    expect(
      (await settleWithLedger(status({ state: "submitted" }), "101", "101", horizon)).state,
    ).toBe("submitted");
    expect(horizon.getTransaction).not.toHaveBeenCalled();
  });
});
