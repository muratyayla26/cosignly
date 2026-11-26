import { describe, expect, it } from "vitest";

import type { CoordinatorStatus } from "../coordinator/types";
import { equalWeightConfig } from "../vault/setup";
import { reviewProposal, type ProposalReviewInput } from "./review";

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
