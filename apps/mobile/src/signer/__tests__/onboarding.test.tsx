import { generateSignerKeypair } from "@cosignly/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import type { ReactElement } from "react";

import ImportKeyScreen from "@/app/onboarding/import";
import RecoveryScreen from "@/app/onboarding/recovery";
import { SignerProvider } from "@/signer";
import * as keyStore from "@/signer/keyStore";
import { SignerKeyError } from "@/signer/keyStore";
import { ThemeProvider } from "@/theme";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => mockParams),
}));
let mockParams: Record<string, string> = {};

jest.mock("expo-clipboard", () => ({
  getStringAsync: jest.fn(() => Promise.resolve("")),
  setStringAsync: jest.fn(() => Promise.resolve(true)),
}));

jest.mock("@/signer/keyStore", () => {
  const actual = jest.requireActual("@/signer/keyStore");
  return {
    ...actual,
    canProtectWithBiometrics: jest.fn(() => true),
    loadSignerPublicKey: jest.fn(() => Promise.resolve(null)),
    saveSignerKey: jest.fn(() => Promise.resolve()),
  };
});

async function renderApp(ui: ReactElement) {
  return await render(
    <ThemeProvider initialPreference="light">
      <SignerProvider>{ui}</SignerProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  jest.mocked(keyStore.canProtectWithBiometrics).mockReturnValue(true);
});

describe("Recovery screen", () => {
  it("creates a key behind biometrics, then shows the ready screen", async () => {
    mockParams = { next: "create" };
    await renderApp(<RecoveryScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "I understand, create my key" }));
    expect(keyStore.saveSignerKey).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/onboarding/ready");
  });

  it("explains a cancelled prompt and stays on the screen", async () => {
    mockParams = { next: "create" };
    jest.mocked(keyStore.saveSignerKey).mockRejectedValueOnce(new SignerKeyError("cancelled"));
    await renderApp(<RecoveryScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "I understand, create my key" }));
    expect(screen.getByText("Not confirmed")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("blocks key creation when biometrics are not set up", async () => {
    mockParams = { next: "create" };
    jest.mocked(keyStore.canProtectWithBiometrics).mockReturnValue(false);
    await renderApp(<RecoveryScreen />);
    expect(screen.getByText("Set up Face ID or fingerprint")).toBeTruthy();
    expect(screen.getByRole("button", { name: "I understand, create my key" })).toBeDisabled();
  });

  it("goes on to the import screen when importing", async () => {
    mockParams = { next: "import" };
    await renderApp(<RecoveryScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "I understand, continue" }));
    expect(router.push).toHaveBeenCalledWith("/onboarding/import");
    expect(keyStore.saveSignerKey).not.toHaveBeenCalled();
  });
});

describe("Import screen", () => {
  it("rejects a public address with a clear message", async () => {
    await renderApp(<ImportKeyScreen />);
    await fireEvent.changeText(
      screen.getByLabelText("Secret key"),
      generateSignerKeypair().publicKey(),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Use this key" }));
    expect(screen.getByText(/This is a public address/)).toBeTruthy();
    expect(keyStore.saveSignerKey).not.toHaveBeenCalled();
  });

  it("imports a valid secret key", async () => {
    const keypair = generateSignerKeypair();
    await renderApp(<ImportKeyScreen />);
    await fireEvent.changeText(screen.getByLabelText("Secret key"), ` ${keypair.secret()}\n`);
    await fireEvent.press(screen.getByRole("button", { name: "Use this key" }));
    const saved = jest.mocked(keyStore.saveSignerKey).mock.calls[0]?.[0];
    expect(saved?.publicKey()).toBe(keypair.publicKey());
    expect(router.replace).toHaveBeenCalledWith("/onboarding/ready");
  });

  it("clears the clipboard after pasting", async () => {
    const keypair = generateSignerKeypair();
    jest.mocked(Clipboard.getStringAsync).mockResolvedValueOnce(keypair.secret());
    await renderApp(<ImportKeyScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Paste from clipboard" }));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("");
    expect(screen.getByLabelText("Secret key").props.value).toBe(keypair.secret());
  });
});
