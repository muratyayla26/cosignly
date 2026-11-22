import { generateSignerKeypair } from "@cosignly/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import type { ReactElement } from "react";
import { Alert } from "react-native";

import ReviewStep from "@/app/vault-setup/review";
import RulesStep from "@/app/vault-setup/rules";
import SignersStep from "@/app/vault-setup/signers";
import { ThemeProvider } from "@/theme";

import type { SetupAction } from "../state";
import { VaultSetupProvider } from "../VaultSetupProvider";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("expo-clipboard", () => ({ getStringAsync: jest.fn(), setStringAsync: jest.fn() }));
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));

const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const SAM = "GDGKPPMM5BORTIJLY2IC2OCU33OACYDRHMOUJAFRXHY4GTYOJD2QT4CY";
const JORDAN = "GDCHQZAQROW52J3O7WJUTFQMCB6HB7TJXVV33LPJS5PIHG3X5H55TXR5";

async function renderStep(ui: ReactElement, actions: SetupAction[] = []) {
  return await render(
    <ThemeProvider initialPreference="light">
      {/* Start as if the earlier steps were done. */}
      <VaultSetupProvider
        ownKey={ALEX}
        initialActions={[{ type: "setName", name: "Team Vault" }, ...actions]}
      >
        {ui}
      </VaultSetupProvider>
    </ThemeProvider>,
  );
}

const createButton = () => screen.getByRole("button", { name: "Create vault" });

beforeEach(() => jest.clearAllMocks());

describe("Signers step", () => {
  it("adds a pasted address and needs at least 2 signers to continue", async () => {
    await renderStep(<SignersStep />);
    expect(screen.getByText("Add at least 1 more signer to continue.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText("Signer address"), SAM);
    await fireEvent.press(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("2 signers")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Next" }));
    expect(router.push).toHaveBeenCalledWith("/vault-setup/rules");
  });

  it("rejects your own address and secret keys", async () => {
    await renderStep(<SignersStep />);
    await fireEvent.changeText(screen.getByLabelText("Signer address"), ALEX);
    await fireEvent.press(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("This is your own address. You are already a signer.")).toBeTruthy();

    await fireEvent.changeText(
      screen.getByLabelText("Signer address"),
      generateSignerKeypair().secret(),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText(/This is a secret key/)).toBeTruthy();
    expect(screen.getByText("1 signer")).toBeTruthy();
  });
});

describe("Rules step", () => {
  it("only offers templates that fit the signers", async () => {
    await renderStep(<RulesStep />, [
      { type: "addSigner", key: SAM },
      { type: "addSigner", key: JORDAN },
    ]);
    expect(screen.getByRole("radio", { name: "2 of 3" })).toBeSelected();
    expect(screen.getByRole("radio", { name: "2 of 2" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "3 of 5" })).toBeDisabled();
    expect(screen.getByText("Payments need 2 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review" })).toBeEnabled();
  });

  it("blocks an invalid custom rule", async () => {
    await renderStep(<RulesStep />, [
      { type: "addSigner", key: SAM },
      { type: "useCustom" },
      { type: "setPayments", value: 2 },
      { type: "setAdmin", value: 1 },
    ]);
    expect(screen.getByText(/Changing signers must need at least as many approvals/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
  });
});

describe("Review step", () => {
  it("2 of 3: shows the summary and reserve cost, and can be submitted", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await renderStep(<ReviewStep />, [
      { type: "addSigner", key: SAM },
      { type: "addSigner", key: JORDAN },
    ]);
    expect(screen.getByText("Team Vault")).toBeTruthy();
    expect(screen.getByText("Payments need 2 of 3")).toBeTruthy();
    expect(screen.getByText("Changing signers needs 2 of 3")).toBeTruthy();
    expect(screen.getByLabelText("1.5 XLM")).toBeTruthy(); // 3 signers × 0.5
    expect(screen.getByLabelText("3 XLM")).toBeTruthy(); // minimum balance
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(createButton()).toBeEnabled();
    await fireEvent.press(createButton());
    expect(alert).toHaveBeenCalled();
  });

  it("2 of 2: the N-1 warning needs explicit confirmation", async () => {
    await renderStep(<ReviewStep />, [{ type: "addSigner", key: SAM }]);
    expect(screen.getByText("Risk of locking the vault")).toBeTruthy();
    expect(createButton()).toBeDisabled();

    const confirm = screen.getByRole("checkbox", { name: /if one signer loses their key/ });
    await fireEvent.press(confirm);
    expect(confirm).toBeChecked();
    expect(createButton()).toBeEnabled();

    await fireEvent.press(confirm);
    expect(createButton()).toBeDisabled();
  });

  it("an invalid setup can never be submitted", async () => {
    await renderStep(<ReviewStep />, [
      { type: "addSigner", key: SAM },
      { type: "useCustom" },
      { type: "setAdmin", value: 2 },
      { type: "setWeight", key: SAM, weight: 1 },
      { type: "setPayments", value: 3 },
    ]);
    expect(screen.getByText("This setup can't be used")).toBeTruthy();
    expect(createButton()).toBeDisabled();
  });

  it("a template that doesn't fit the signers is blocked", async () => {
    await renderStep(<ReviewStep />, [
      { type: "addSigner", key: SAM },
      { type: "useTemplate", templateId: "3-of-5" },
    ]);
    expect(screen.getByText("Rules don't match the signers")).toBeTruthy();
    expect(createButton()).toBeDisabled();
  });
});
