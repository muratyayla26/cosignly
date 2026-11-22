import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import type { ReactElement, useEffect } from "react";
import { AppState } from "react-native";

import HomeScreen from "@/app/index";
import VaultScreen from "@/app/vault/[id]";
import { useSigner } from "@/signer";
import { ThemeProvider } from "@/theme";

// Real testnet responses (packages/shared fixtures) for the CLI-created 2-of-3 vault.
import accountsBySigner from "../../../../../packages/shared/src/horizon/__fixtures__/accounts-by-signer.json";
import root from "../../../../../packages/shared/src/horizon/__fixtures__/root.json";
import vaultAccount from "../../../../../packages/shared/src/horizon/__fixtures__/vault-account.json";
import vaultOperations from "../../../../../packages/shared/src/horizon/__fixtures__/vault-operations.json";

const VAULT = "GDDTBEBLVLD32OEMRUEXH7KEHYK5VRVN6ZXAJF7NIWMUG3ATUGTCNLOL";
const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";

// Route Horizon URLs to fixtures (or a per-test override).
let mockRoutes: Record<string, () => unknown> = {};
const mockFetch = jest.fn(async (url: string) => {
  const path = new URL(url).pathname + new URL(url).search;
  const match = Object.keys(mockRoutes).find((prefix) => path.startsWith(prefix));
  if (!match) throw new TypeError("Network request failed");
  const body = mockRoutes[match]?.();
  if (body === 404) return new Response(JSON.stringify({ status: 404 }), { status: 404 });
  return new Response(JSON.stringify(body), { status: 200 });
});

jest.mock("@/lib/stellar", () => {
  const shared = jest.requireActual("@cosignly/shared");
  const network = shared.getNetworkConfig();
  return {
    network,
    horizon: shared.createHorizonClient({
      network,
      fetch: (url: string) => mockFetch(url),
    }),
  };
});

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Redirect: () => null,
  // Runs like an effect: once per mount (the screen's first focus).
  useFocusEffect: (cb: () => void) =>
    jest.requireActual<{ useEffect: typeof useEffect }>("react").useEffect(cb, [cb]),
  Stack: { Screen: () => null },
  useLocalSearchParams: jest.fn(() => ({
    id: "GDDTBEBLVLD32OEMRUEXH7KEHYK5VRVN6ZXAJF7NIWMUG3ATUGTCNLOL",
  })),
}));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
jest.mock("@/signer", () => ({ useSigner: jest.fn() }));

async function renderScreen(ui: ReactElement) {
  return await render(<ThemeProvider initialPreference="light">{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useSigner).mockReturnValue({
    state: { status: "ready", publicKey: ALEX },
  } as ReturnType<typeof useSigner>);
  mockRoutes = {
    "/accounts?signer=": () => accountsBySigner,
    [`/accounts/${VAULT}/operations`]: () => vaultOperations,
    [`/accounts/${VAULT}`]: () => vaultAccount,
    "/": () => root,
  };
});

describe("Home (vault list)", () => {
  it("finds the vault the signer key belongs to and opens it", async () => {
    await renderScreen(<HomeScreen />);
    expect(await screen.findByText("Vault GDDT…NLOL")).toBeTruthy();
    expect(screen.getByText("Payments need 2 of 3")).toBeTruthy();
    expect(screen.getByText("9,999.99995 XLM")).toBeTruthy();
    expect(screen.getByText("0 USDC")).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`/accounts?signer=${ALEX}`));

    await fireEvent.press(screen.getByRole("button", { name: /Vault GDDT…NLOL/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/vault/[id]", params: { id: VAULT } });
    await fireEvent.press(screen.getByRole("button", { name: "Create a vault" }));
    expect(router.push).toHaveBeenCalledWith("/vault-setup");
  });

  it("explains what to do when the key is in no vault yet", async () => {
    mockRoutes["/accounts?signer="] = () => ({ _links: {}, _embedded: { records: [] } });
    await renderScreen(<HomeScreen />);
    expect(await screen.findByText("No vaults yet")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Show my address" }));
    expect(router.push).toHaveBeenCalledWith("/settings");
    await fireEvent.press(screen.getByRole("button", { name: "Create a vault" }));
    expect(router.push).toHaveBeenCalledWith("/vault-setup");
  });

  it("shows an offline warning when Horizon cannot be reached", async () => {
    mockRoutes = {};
    await renderScreen(<HomeScreen />);
    expect(await screen.findByText("Couldn't load your vaults")).toBeTruthy();
    expect(await screen.findByText("Can't reach Stellar Testnet")).toBeTruthy();
  });

  it("reloads when the app returns to the foreground; a failed reload keeps the last results", async () => {
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      listeners.push(listener as (state: string) => void);
      return { remove: jest.fn() };
    });
    await renderScreen(<HomeScreen />);
    await screen.findByText("Vault GDDT…NLOL");
    mockRoutes = {};
    await act(async () => {
      for (const l of listeners) l("active");
    });
    expect(await screen.findByText("Showing saved results")).toBeTruthy();
    expect(screen.getByText("Vault GDDT…NLOL")).toBeTruthy();
  });
});

describe("Vault detail", () => {
  it("shows balances, reserve, rules, signers and history in plain language", async () => {
    await renderScreen(<VaultScreen />);
    expect(await screen.findByText("Payments need 2 of 3")).toBeTruthy();
    expect(screen.getByText("Changing signers needs 2 of 3")).toBeTruthy();
    expect(screen.getByText(/keeps 3 XLM in reserve/)).toBeTruthy();
    expect(screen.getByText("Signers (3)".toUpperCase())).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy(); // Alex is this phone's key
    expect(screen.getByText("Received 25 XLM")).toBeTruthy();
    expect(screen.getByText("Vault opened with 10,000 XLM")).toBeTruthy();
    expect(screen.getAllByText("Added or updated a signer")).toHaveLength(3);
    // A healthy 2-of-3 setup has no warnings.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains a vault removed by a testnet reset", async () => {
    mockRoutes[`/accounts/${VAULT}`] = () => 404;
    mockRoutes[`/accounts/${VAULT}/operations`] = () => 404;
    await renderScreen(<VaultScreen />);
    expect(await screen.findByText("This vault no longer exists")).toBeTruthy();
  });
});
