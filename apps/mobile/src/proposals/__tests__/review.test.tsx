import {
  buildPaymentProposal,
  generateSignerKeypair,
  getNetworkConfig,
  getUsdc,
  toAccountInfo,
  type CoordinatorStatus,
  type HorizonAccount,
  type Keypair,
} from "@cosignly/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { Share } from "react-native";

import OpenProposalScreen from "@/app/proposal/open";
import ProposalScreen from "@/app/proposal/[hash]";
import { coordinator } from "@/lib/stellar";
import { useSigner } from "@/signer";
import { ThemeProvider } from "@/theme";

import vaultAccountFixture from "../../../../../packages/shared/src/horizon/__fixtures__/vault-account.json";
import setupAccount from "../../../../../packages/shared/src/vault/__fixtures__/setup-account.json";

// The real W2.2 2-of-3 vault (Alex, Sam, Jordan) paying the W1.2 CLI vault.
const VAULT = setupAccount.id;
const RECIPIENT = vaultAccountFixture.id;
const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const SAM = "GDGKPPMM5BORTIJLY2IC2OCU33OACYDRHMOUJAFRXHY4GTYOJD2QT4CY";
const JORDAN = "GDCHQZAQROW52J3O7WJUTFQMCB6HB7TJXVV33LPJS5PIHG3X5H55TXR5";
const HASH = "cd".repeat(32);

let mockVault: unknown = setupAccount;
/** What Horizon has under /transactions/<hash> (null = not in a ledger). */
let mockLedgerTx: { successful: boolean } | null = null;
jest.mock("@/lib/stellar", () => {
  const shared = jest.requireActual("@cosignly/shared");
  const network = shared.getNetworkConfig();
  return {
    network,
    usdc: shared.getUsdc("testnet"),
    horizon: shared.createHorizonClient({
      network,
      fetch: async (url: string) => {
        if (url.includes("/transactions/")) {
          return mockLedgerTx
            ? new Response(
                JSON.stringify({ hash: url.split("/").pop(), ledger: 1, ...mockLedgerTx }),
              )
            : new Response(JSON.stringify({ status: 404 }), { status: 404 });
        }
        return new Response(JSON.stringify(mockVault), { status: 200 });
      },
    }),
    coordinator: { propose: jest.fn(), getStatus: jest.fn(), addSignature: jest.fn() },
  };
});
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({
    hash: "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd",
  }),
}));
jest.mock("expo-clipboard", () => ({ getStringAsync: jest.fn(), setStringAsync: jest.fn() }));
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
jest.mock("@/signer", () => ({ ...jest.requireActual("@/signer"), useSigner: jest.fn() }));

const vault = toAccountInfo(setupAccount as HorizonAccount);
const envelope = buildPaymentProposal({
  vault,
  draft: { asset: "XLM", destination: RECIPIENT, amount: "25", memo: "Rent March" },
  usdc: getUsdc("testnet"),
  network: getNetworkConfig(),
}).toXDR();

const status = (overrides: Partial<CoordinatorStatus> = {}): CoordinatorStatus => ({
  network: "testnet",
  hash: HASH,
  state: "collecting",
  xdr: envelope,
  signedBy: [ALEX],
  ...overrides,
});

let samKey: Keypair;
const unlock = jest.fn(async (_p: string, withKey: (k: Keypair) => unknown) => withKey(samKey));
const asSigner = (publicKey: string) =>
  jest.mocked(useSigner).mockReturnValue({
    state: { status: "ready", publicKey },
    unlock,
  } as unknown as ReturnType<typeof useSigner>);

async function renderScreen(ui = <ProposalScreen />) {
  return await render(<ThemeProvider initialPreference="light">{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVault = setupAccount;
  mockLedgerTx = null;
  samKey = generateSignerKeypair();
  asSigner(SAM);
  jest.mocked(coordinator.getStatus).mockResolvedValue(status());
});

describe("Review and approve", () => {
  it("shows the payment in plain language with its approvals", async () => {
    await renderScreen();
    expect(await screen.findByText("Send 25 XLM to GDDT…NLOL")).toBeTruthy();
    expect(screen.getByText("Rent March")).toBeTruthy();
    expect(screen.getByText("up to 0.0001 XLM")).toBeTruthy();
    expect(screen.getByLabelText("1 of 2 approvals")).toBeTruthy();
    expect(screen.getAllByText("Approved")).toHaveLength(1);
    expect(screen.getAllByText("Waiting")).toHaveLength(2);
    // No jargon outside Details.
    expect(screen.queryByText(HASH)).toBeNull();
  });

  it("approves with the signer key and merges the signature", async () => {
    jest
      .mocked(coordinator.addSignature)
      .mockResolvedValue(status({ state: "ready", signedBy: [ALEX, SAM] }));
    await renderScreen();
    // The re-check right before signing still sees 1 of 2; afterwards it's ready.
    jest
      .mocked(coordinator.getStatus)
      .mockResolvedValueOnce(status())
      .mockResolvedValue(status({ state: "ready", signedBy: [ALEX, SAM] }));
    await fireEvent.press(await screen.findByRole("button", { name: "Approve" }));

    expect(unlock).toHaveBeenCalledWith("Approve: Send 25 XLM to GDDT…NLOL", expect.any(Function));
    const signed = jest.mocked(coordinator.addSignature).mock.calls[0]?.[0];
    expect(signed?.network).toBe("testnet");
    expect(signed?.signedXdr).not.toBe(envelope); // carries the new signature
    expect(await screen.findByText("Approved. Sending to Stellar…")).toBeTruthy();
  });

  it("doesn't sign when enough approvals arrived meanwhile", async () => {
    asSigner(JORDAN);
    await renderScreen();
    const approve = await screen.findByRole("button", { name: "Approve" });
    jest.mocked(coordinator.getStatus).mockResolvedValue(status({ signedBy: [ALEX, SAM] }));
    await fireEvent.press(approve);
    expect(
      await screen.findByText("Enough signers approved meanwhile. Your approval isn't needed."),
    ).toBeTruthy();
    expect(unlock).not.toHaveBeenCalled();
    expect(coordinator.addSignature).not.toHaveBeenCalled();
  });

  it("the proposer sees their approval and can share the signing link", async () => {
    asSigner(ALEX);
    const share = jest
      .spyOn(Share, "share")
      .mockResolvedValue({ action: "sharedAction", activityType: undefined });
    await renderScreen();
    expect(await screen.findByText("You approved this payment.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Share signing link" }));
    const message = share.mock.calls[0]?.[0].message ?? "";
    expect(message).toContain(`cosignly://proposal/${HASH}`);
    expect(message).toContain(`https://refractor.space/tx/${HASH}`);
  });

  it("a cancelled biometric prompt sends nothing", async () => {
    const { SignerKeyError } = jest.requireActual("@/signer");
    unlock.mockRejectedValueOnce(new SignerKeyError("cancelled"));
    await renderScreen();
    await fireEvent.press(await screen.findByRole("button", { name: "Approve" }));
    expect(coordinator.addSignature).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Approve" })).toBeTruthy();
  });

  it.each([
    [status({ state: "submitted", signedBy: [ALEX, SAM] }), "Sent"],
    [
      status({ state: "failed", error: "Tx error: txBadSeq" }),
      "Stellar didn't accept this payment",
    ],
    [status({ state: "expired" }), "Expired"],
  ])("finished: %#", async (s, title) => {
    jest.mocked(coordinator.getStatus).mockResolvedValue(s);
    await renderScreen();
    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("stale: another transaction used the sequence number", async () => {
    mockVault = { ...setupAccount, sequence: (BigInt(setupAccount.sequence) + 1n).toString() };
    await renderScreen();
    expect(await screen.findByText("This payment can't be sent anymore")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Propose again" }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/propose/[vaultId]",
      params: { vaultId: VAULT },
    });
  });

  it("Refractor lagging behind the ledger shows Sent, not stale", async () => {
    // The vault's sequence already moved on while Refractor still says "processing".
    mockVault = { ...setupAccount, sequence: (BigInt(setupAccount.sequence) + 1n).toString() };
    mockLedgerTx = { successful: true };
    jest
      .mocked(coordinator.getStatus)
      .mockResolvedValue(status({ state: "ready", signedBy: [ALEX, SAM] }));
    await renderScreen();
    expect(await screen.findByText("Sent")).toBeTruthy();
    expect(screen.queryByText("This payment can't be sent anymore")).toBeNull();
  });

  it("warnings must be confirmed before approving", async () => {
    // A proposal whose envelope also contains an operation Cosignly can't read.
    const fixtures = jest.requireActual(
      "../../../../../packages/shared/src/tx/__fixtures__/transactions.json",
    );
    const mixed = fixtures.transactions.find((t: { id: string }) => t.id === "mixed-unknown");
    mockVault = { ...setupAccount, id: fixtures.accounts.alex, sequence: "0" };
    jest
      .mocked(coordinator.getStatus)
      .mockResolvedValue(status({ xdr: mixed.envelope_xdr, signedBy: [] }));
    await renderScreen();
    expect(await screen.findByText(/includes an action Cosignly can't read/)).toBeTruthy();
    const approve = screen.getByRole("button", { name: "Approve" });
    expect(approve).toBeDisabled();
    await fireEvent.press(screen.getByRole("checkbox"));
    expect(approve).toBeEnabled();
  });

  it("an unknown link shows not found", async () => {
    const { RefractorError } = jest.requireActual("@cosignly/shared");
    jest.mocked(coordinator.getStatus).mockRejectedValue(new RefractorError(404, "not found"));
    await renderScreen();
    expect(await screen.findByText("Payment not found")).toBeTruthy();
  });
});

describe("Open a proposal link", () => {
  it("opens Cosignly and Refractor links, rejects others", async () => {
    await renderScreen(<OpenProposalScreen />);
    const field = screen.getByLabelText("Proposal link");
    await fireEvent.changeText(field, "https://example.com/nothing");
    await fireEvent.press(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("This isn't a Cosignly or Refractor proposal link.")).toBeTruthy();

    await fireEvent.changeText(field, `https://refractor.space/tx/${HASH}`);
    await fireEvent.press(screen.getByRole("button", { name: "Open" }));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/proposal/[hash]",
      params: { hash: HASH },
    });
  });
});
