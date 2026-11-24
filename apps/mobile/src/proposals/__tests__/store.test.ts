import {
  RefractorError,
  toAccountInfo,
  type CoordinatorStatus,
  type HorizonAccount,
  type SignatureCoordinator,
} from "@cosignly/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";

import setupAccount from "../../../../../packages/shared/src/vault/__fixtures__/setup-account.json";
import {
  loadLocalProposal,
  loadPendingProposal,
  saveLocalProposal,
  type LocalProposal,
} from "../store";

// The real W2.2 vault (2-of-3).
const vault = toAccountInfo(setupAccount as HorizonAccount);
const next = (BigInt(vault.sequence) + 1n).toString();
const HASH = "ab".repeat(32);

const local: LocalProposal = {
  vaultId: vault.id,
  hash: HASH,
  title: "Send 25 XLM to Sam",
  sequence: next,
  createdAt: "2026-11-24T12:00:00.000Z",
};

const coordinatorReturning = (status: Partial<CoordinatorStatus> | Error) =>
  ({
    propose: jest.fn(),
    addSignature: jest.fn(),
    getStatus: jest.fn(async () => {
      if (status instanceof Error) throw status;
      return {
        network: "testnet",
        hash: HASH,
        state: "collecting",
        xdr: "",
        signedBy: [],
        ...status,
      };
    }),
  }) as unknown as SignatureCoordinator;

beforeEach(() => AsyncStorage.clear());

describe("local proposals", () => {
  it("nothing stored → no pending proposal, no network call", async () => {
    const c = coordinatorReturning({});
    expect(await loadPendingProposal(vault, c)).toBeNull();
    expect(c.getStatus).not.toHaveBeenCalled();
  });

  it("collecting on the vault's next sequence → open", async () => {
    await saveLocalProposal(local);
    const pending = await loadPendingProposal(vault, coordinatorReturning({ state: "collecting" }));
    expect(pending).toMatchObject({ open: true, stale: false, local });
  });

  it("the vault used its sequence for something else → stale, not open", async () => {
    await saveLocalProposal(local);
    const moved = { ...vault, sequence: next };
    expect(
      await loadPendingProposal(moved, coordinatorReturning({ state: "collecting" })),
    ).toMatchObject({
      open: false,
      stale: true,
    });
  });

  it("submitted, failed or expired → not open", async () => {
    await saveLocalProposal(local);
    for (const state of ["submitted", "failed", "expired"] as const) {
      expect((await loadPendingProposal(vault, coordinatorReturning({ state })))?.open).toBe(false);
    }
  });

  it("a proposal the coordinator no longer knows is forgotten", async () => {
    await saveLocalProposal(local);
    expect(
      await loadPendingProposal(vault, coordinatorReturning(new RefractorError(404, "nope"))),
    ).toBeNull();
    expect(await loadLocalProposal(vault.id)).toBeNull();
  });

  it("other errors are not swallowed", async () => {
    await saveLocalProposal(local);
    await expect(
      loadPendingProposal(vault, coordinatorReturning(new RefractorError(0, "offline"))),
    ).rejects.toThrow("offline");
    expect(await loadLocalProposal(vault.id)).toEqual(local);
  });
});
