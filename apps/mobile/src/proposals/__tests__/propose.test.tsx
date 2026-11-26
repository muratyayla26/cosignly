import { generateSignerKeypair, type Keypair } from "@cosignly/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import ProposePaymentScreen from "@/app/propose/[vaultId]";
import { coordinator } from "@/lib/stellar";
import { useSigner } from "@/signer";
import { ThemeProvider } from "@/theme";

import vaultAccountFixture from "../../../../../packages/shared/src/horizon/__fixtures__/vault-account.json";
import setupAccount from "../../../../../packages/shared/src/vault/__fixtures__/setup-account.json";
import { loadLocalProposal, saveLocalProposal } from "../store";

// Real testnet accounts: the W2.2 2-of-3 vault (Alex, Sam, Jordan) and, as the
// recipient, the W1.2 CLI vault.
const VAULT = setupAccount.id;
const RECIPIENT = vaultAccountFixture.id;
const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const HASH = "cd".repeat(32);

let mockAccounts: Record<string, unknown> = {};
jest.mock("@/lib/stellar", () => {
  const shared = jest.requireActual("@cosignly/shared");
  const network = shared.getNetworkConfig();
  return {
    network,
    usdc: shared.getUsdc("testnet"),
    horizon: shared.createHorizonClient({
      network,
      fetch: async (url: string) => {
        const id = new URL(url).pathname.split("/").pop() ?? "";
        const body = mockAccounts[id];
        return body
          ? new Response(JSON.stringify(body), { status: 200 })
          : new Response(JSON.stringify({ status: 404 }), { status: 404 });
      },
    }),
    coordinator: { propose: jest.fn(), getStatus: jest.fn(), addSignature: jest.fn() },
  };
});
jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({
    vaultId: "GDQMJCBAHXJPIPXGIZH63TYOAFOZW3GO3IVWN6STSAWU2BV7YRTNZQA6",
  }),
}));
jest.mock("expo-clipboard", () => ({ getStringAsync: jest.fn(), setStringAsync: jest.fn() }));
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
jest.mock("@/signer", () => ({
  ...jest.requireActual("@/signer"),
  useSigner: jest.fn(),
}));

let alex: Keypair;
const unlock = jest.fn(async (_prompt: string, withKey: (k: Keypair) => unknown) => withKey(alex));

async function renderScreen() {
  return await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 393, height: 852 },
        insets: { top: 59, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider initialPreference="light">
        <ProposePaymentScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

async function fill(amount: string, destination = RECIPIENT) {
  await fireEvent.changeText(await screen.findByLabelText("Recipient"), destination);
  await fireEvent.changeText(screen.getByLabelText("Amount (XLM)"), amount);
  await fireEvent.changeText(screen.getByLabelText("Note (optional)"), "Rent March");
  await fireEvent.press(screen.getByRole("button", { name: "Review" }));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  // A key that is one of the vault's signers. The signature itself isn't checked here.
  alex = generateSignerKeypair();
  mockAccounts = { [VAULT]: setupAccount, [RECIPIENT]: vaultAccountFixture };
  jest.mocked(useSigner).mockReturnValue({
    state: { status: "ready", publicKey: ALEX },
    unlock,
  } as unknown as ReturnType<typeof useSigner>);
  jest.mocked(coordinator.propose).mockResolvedValue({ network: "testnet", hash: HASH });
  jest.mocked(coordinator.getStatus).mockResolvedValue({
    network: "testnet",
    hash: HASH,
    state: "collecting",
    xdr: "",
    signedBy: [ALEX],
  });
});

describe("Propose payment", () => {
  it("reviews, signs with the key and uploads a 7-day proposal", async () => {
    await renderScreen();
    await fill("25");

    expect(await screen.findByText("Send 25 XLM to GDDT…NLOL")).toBeTruthy();
    expect(screen.getByText("Rent March")).toBeTruthy();
    expect(screen.getByText("up to 0.0001 XLM")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Sign and propose" }));
    expect(await screen.findByText("Payment proposed")).toBeTruthy();
    expect(screen.getByLabelText("1 of 2 approvals")).toBeTruthy();

    expect(unlock).toHaveBeenCalledWith("Sign: Send 25 XLM to GDDT…NLOL", expect.any(Function));
    const input = jest.mocked(coordinator.propose).mock.calls[0]?.[0];
    expect(input).toMatchObject({ network: "testnet", submitWhenReady: true });
    const days = ((input?.expiresAt?.getTime() ?? 0) - Date.now()) / 86_400_000;
    expect(days).toBeCloseTo(7, 1);

    expect(await loadLocalProposal(VAULT)).toMatchObject({
      hash: HASH,
      title: "Send 25 XLM to GDDT…NLOL",
      sequence: (BigInt(setupAccount.sequence) + 1n).toString(),
    });
  });

  it("explains problems before anything is signed", async () => {
    await renderScreen();
    await fill("25", "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7");
    expect(
      await screen.findByText(
        "This account doesn't exist on Stellar yet. Payments can only go to existing accounts.",
      ),
    ).toBeTruthy();

    await fill("20000");
    expect(await screen.findByText(/The vault can send at most 9,996\.99985 XLM\./)).toBeTruthy();
    expect(unlock).not.toHaveBeenCalled();
    expect(coordinator.propose).not.toHaveBeenCalled();
  });

  it("only one payment can wait for approval per vault", async () => {
    await saveLocalProposal({
      vaultId: VAULT,
      hash: HASH,
      title: "Send 5 XLM to Sam",
      sequence: (BigInt(setupAccount.sequence) + 1n).toString(),
      createdAt: new Date().toISOString(),
    });
    await renderScreen();
    expect(await screen.findByText("A payment is already waiting for approval")).toBeTruthy();
    expect(screen.queryByLabelText("Recipient")).toBeNull();
  });

  it("a cancelled biometric prompt uploads nothing", async () => {
    const { SignerKeyError } = jest.requireActual("@/signer");
    unlock.mockRejectedValueOnce(new SignerKeyError("cancelled"));
    await renderScreen();
    await fill("25");
    await fireEvent.press(await screen.findByRole("button", { name: "Sign and propose" }));
    expect(await screen.findByRole("button", { name: "Sign and propose" })).toBeTruthy();
    expect(coordinator.propose).not.toHaveBeenCalled();
    expect(await loadLocalProposal(VAULT)).toBeNull();
  });

  it("a key that isn't a signer can't propose", async () => {
    jest.mocked(useSigner).mockReturnValue({
      state: { status: "ready", publicKey: generateSignerKeypair().publicKey() },
      unlock,
    } as unknown as ReturnType<typeof useSigner>);
    await renderScreen();
    expect(await screen.findByText("Your key is not a signer of this vault.")).toBeTruthy();
  });
});
