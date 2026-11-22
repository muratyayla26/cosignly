import { startVaultCreation, VaultCreationError, type VaultCreation } from "@cosignly/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import type { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import CreateVaultScreen from "@/app/vault-setup/create";
import { ThemeProvider } from "@/theme";
import { VAULT_NAMES_STORAGE_KEY, VaultNamesProvider } from "@/vaults/names";

import type { SetupAction } from "../state";
import { VaultSetupProvider } from "../VaultSetupProvider";

const mockParentOptions = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), dismissTo: jest.fn() },
  Stack: { Screen: () => null },
  useNavigation: () => ({ getParent: () => ({ setOptions: mockParentOptions }) }),
  useFocusEffect: (cb: () => void) =>
    jest.requireActual<{ useEffect: typeof useEffect }>("react").useEffect(cb, [cb]),
}));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
jest.mock("@cosignly/shared", () => ({
  ...jest.requireActual("@cosignly/shared"),
  startVaultCreation: jest.fn(),
}));

const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const SAM = "GDGKPPMM5BORTIJLY2IC2OCU33OACYDRHMOUJAFRXHY4GTYOJD2QT4CY";
const JORDAN = "GDCHQZAQROW52J3O7WJUTFQMCB6HB7TJXVV33LPJS5PIHG3X5H55TXR5";
// The real 2-of-3 vault created on testnet on 2026-11-22.
const VAULT = "GDQMJCBAHXJPIPXGIZH63TYOAFOZW3GO3IVWN6STSAWU2BV7YRTNZQA6";
const TX = "6f0a330c7cc9b3c669d094b08b3ed7d175849dce08cfa96ce9831f350dad1f1a";

const twoOfThree: SetupAction[] = [
  { type: "setName", name: "Team Vault" },
  { type: "addSigner", key: SAM },
  { type: "addSigner", key: JORDAN },
];

async function renderCreate(actions: SetupAction[] = twoOfThree) {
  return await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 393, height: 852 },
        insets: { top: 59, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider initialPreference="light">
        <VaultNamesProvider>
          <VaultSetupProvider ownKey={ALEX} initialActions={actions}>
            <CreateVaultScreen />
          </VaultSetupProvider>
        </VaultNamesProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

function mockCreation(run: VaultCreation["run"]) {
  const creation = { accountId: VAULT, run: jest.fn(run) };
  jest.mocked(startVaultCreation).mockReturnValue(creation);
  return creation;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("Create vault screen", () => {
  it("creates the vault, saves its name on the phone and opens it", async () => {
    mockCreation(async (onStep) => {
      onStep?.("fund");
      onStep?.("configure");
      onStep?.("verify");
      return { accountId: VAULT, txHash: TX, account: {} as never };
    });
    await renderCreate();

    expect(await screen.findByText("Your vault is ready")).toBeTruthy();
    expect(startVaultCreation).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          signers: [ALEX, SAM, JORDAN].map((key) => ({ key, weight: 1 })),
          thresholds: { low: 2, medium: 2, high: 2 },
          masterWeight: 0,
        },
      }),
    );
    expect(JSON.parse((await AsyncStorage.getItem(VAULT_NAMES_STORAGE_KEY)) ?? "{}")).toEqual({
      [VAULT]: "Team Vault",
    });

    // Home → vault: back from the vault goes to Home, not into the wizard.
    await fireEvent.press(screen.getByRole("button", { name: "Open vault" }));
    expect(router.dismissTo).toHaveBeenCalledWith("/");
    expect(router.push).toHaveBeenCalledWith({ pathname: "/vault/[id]", params: { id: VAULT } });
    expect(jest.mocked(router.dismissTo).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(router.push).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("shows the failed step and resumes the same creation on Try again", async () => {
    const creation = mockCreation(async (onStep) => {
      onStep?.("configure");
      throw new VaultCreationError("configure", "Stellar didn't accept the vault setup.");
    });
    await renderCreate();
    expect(await screen.findByText("The vault wasn't created")).toBeTruthy();
    expect(screen.getByText("Stellar didn't accept the vault setup.")).toBeTruthy();
    // The whole wizard can't be swiped away while this screen is open.
    expect(mockParentOptions).toHaveBeenCalledWith({ gestureEnabled: false });

    creation.run.mockImplementationOnce(async () => ({
      accountId: VAULT,
      txHash: TX,
      account: {} as never,
    }));
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Your vault is ready")).toBeTruthy();
    // Same in-memory creation: no new setup key, no second Friendbot request.
    expect(startVaultCreation).toHaveBeenCalledTimes(1);
    expect(creation.run).toHaveBeenCalledTimes(2);
  });

  it("Close leaves the wizard for Home", async () => {
    mockCreation(async () => {
      throw new VaultCreationError("fund", "Couldn't reach Friendbot to fund the vault.");
    });
    await renderCreate();
    await fireEvent.press(await screen.findByRole("button", { name: "Close" }));
    expect(router.dismissTo).toHaveBeenCalledWith("/");
  });

  it("never starts for a setup whose warnings weren't confirmed", async () => {
    await renderCreate([
      { type: "setName", name: "Team Vault" },
      { type: "addSigner", key: SAM },
    ]);
    expect(await screen.findByText("Go back and review the vault setup.")).toBeTruthy();
    await waitFor(() => expect(startVaultCreation).not.toHaveBeenCalled());
  });
});
