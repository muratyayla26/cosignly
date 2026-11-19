import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import type { ReactElement } from "react";
import { Text as RNText } from "react-native";

import { ThemeProvider, useTheme, type AppearancePreference } from "@/theme";
import { dark, light } from "@/theme/tokens";

import {
  AddressChip,
  AmountText,
  Banner,
  Button,
  QuorumProgress,
  SegmentedControl,
  StatusBadge,
  Text,
} from "..";

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

const VAULT = "GDDTBEBLVLD32OEMRUEXH7KEHYK5VRVN6ZXAJF7NIWMUG3ATUGTCNLOL";

async function renderThemed(ui: ReactElement, preference: AppearancePreference = "light") {
  return await render(<ThemeProvider initialPreference={preference}>{ui}</ThemeProvider>);
}

const flatColor = (style: unknown): unknown =>
  (Array.isArray(style) ? Object.assign({}, ...style.flat(Infinity)) : style)?.color;

describe("ThemeProvider", () => {
  it("uses light tokens for the light preference and dark tokens for dark", async () => {
    await renderThemed(<Text>Light</Text>, "light");
    expect(flatColor(screen.getByText("Light").props.style)).toBe(light.text);
    await screen.unmount();

    await renderThemed(<Text>Dark</Text>, "dark");
    expect(flatColor(screen.getByText("Dark").props.style)).toBe(dark.text);
  });

  it("lets components switch the preference", async () => {
    function Probe() {
      const { scheme, setPreference } = useTheme();
      return (
        <RNText accessibilityRole="button" onPress={() => setPreference("dark")}>
          {scheme}
        </RNText>
      );
    }
    await renderThemed(<Probe />, "light");
    await fireEvent.press(screen.getByRole("button"));
    expect(screen.getByText("dark")).toBeTruthy();
  });

  it("throws a clear error when used outside the provider", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(render(<Text>Orphan</Text>)).rejects.toThrow(
      "useTheme must be used inside <ThemeProvider>.",
    );
  });
});

describe("QuorumProgress", () => {
  it("labels progress and fills one dot per approval", async () => {
    await renderThemed(<QuorumProgress approvals={1} required={2} />);
    expect(screen.getByText("1 of 2 approvals")).toBeTruthy();
    expect(screen.getAllByTestId("quorum-dot-approved")).toHaveLength(1);
    expect(screen.getAllByTestId("quorum-dot-pending")).toHaveLength(1);
    expect(screen.getByRole("progressbar")).toHaveProp("accessibilityValue", {
      min: 0,
      max: 2,
      now: 1,
    });
  });

  it("clamps approvals to the required count", async () => {
    await renderThemed(<QuorumProgress approvals={5} required={2} />);
    expect(screen.getByText("2 of 2 approvals")).toBeTruthy();
    expect(screen.queryAllByTestId("quorum-dot-pending")).toHaveLength(0);
  });

  it("can hide its label but keeps it for screen readers", async () => {
    await renderThemed(<QuorumProgress approvals={0} required={3} hideLabel />);
    expect(screen.queryByText("0 of 3 approvals")).toBeNull();
    expect(screen.getByLabelText("0 of 3 approvals")).toBeTruthy();
  });
});

describe("StatusBadge", () => {
  it.each([
    ["pending", "Pending"],
    ["ready", "Ready"],
    ["executed", "Executed"],
    ["expired", "Expired"],
    ["stale", "Outdated"],
    ["failed", "Failed"],
  ] as const)("shows a label for %s (never color alone)", async (status, label) => {
    await renderThemed(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByLabelText(`Status: ${label}`)).toBeTruthy();
  });
});

describe("AmountText", () => {
  it("formats the amount and appends the asset code", async () => {
    await renderThemed(<AmountText amount="1234.5000000" assetCode="USDC" />);
    expect(screen.getByText("1,234.5 USDC")).toBeTruthy();
  });

  it("uses tabular digits", async () => {
    await renderThemed(<AmountText amount="500.0000000" assetCode="XLM" />);
    const style = Object.assign({}, ...[screen.getByText("500 XLM").props.style].flat(Infinity));
    expect(style.fontVariant).toEqual(["tabular-nums"]);
  });
});

describe("AddressChip", () => {
  it("shows a middle-truncated address and copies the full one", async () => {
    await renderThemed(<AddressChip address={VAULT} name="Team Vault" />);
    expect(screen.getByText("GDDT…NLOL")).toBeTruthy();
    expect(screen.getByText("Team Vault")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Copy address"));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(VAULT);
  });

  it("offers an explorer link only when asked", async () => {
    await renderThemed(<AddressChip address={VAULT} />);
    expect(screen.queryByLabelText("View on stellar.expert")).toBeNull();
    await screen.unmount();
    await renderThemed(<AddressChip address={VAULT} showExplorerLink />);
    expect(screen.getByLabelText("View on stellar.expert")).toBeTruthy();
  });
});

describe("Button", () => {
  it("calls onPress", async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Approve" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Approve" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each([{ disabled: true }, { loading: true }])("does not fire when %o", async (props) => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Approve" onPress={onPress} {...props} />);
    await fireEvent.press(screen.getByRole("button", { name: "Approve" }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("Banner", () => {
  it("renders title and message, announcing warnings as alerts", async () => {
    await renderThemed(
      <Banner tone="warning" title="Risky setup" message="Losing one key locks it." />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Risky setup")).toBeTruthy();
    expect(screen.getByText("Losing one key locks it.")).toBeTruthy();
  });
});

describe("SegmentedControl", () => {
  it("marks the selected option and reports changes", async () => {
    const onChange = jest.fn();
    await renderThemed(
      <SegmentedControl
        accessibilityLabel="Appearance"
        options={[
          { value: "system", label: "System" },
          { value: "dark", label: "Dark" },
        ]}
        value="system"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("radio", { name: "System" })).toBeSelected();
    await fireEvent.press(screen.getByRole("radio", { name: "Dark" }));
    expect(onChange).toHaveBeenCalledWith("dark");
  });
});
