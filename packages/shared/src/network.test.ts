import { describe, expect, it } from "vitest";

import { assetCode, getUsdc, isSameAsset, XLM } from "./assets";
import {
  DEFAULT_NETWORK,
  explorerAccountUrl,
  explorerTransactionUrl,
  getNetworkConfig,
  MAINNET_ENABLED,
  TESTNET,
} from "./network";

describe("network config", () => {
  it("defaults to testnet", () => {
    expect(DEFAULT_NETWORK).toBe("testnet");
    expect(getNetworkConfig()).toBe(TESTNET);
    expect(TESTNET.passphrase).toBe("Test SDF Network ; September 2015");
  });

  it("keeps mainnet disabled", () => {
    expect(MAINNET_ENABLED).toBe(false);
    expect(() => getNetworkConfig("public")).toThrow(/Mainnet is not enabled/);
  });

  it("builds stellar.expert links", () => {
    expect(explorerAccountUrl(TESTNET, "GABC")).toBe(
      "https://stellar.expert/explorer/testnet/account/GABC",
    );
    expect(explorerTransactionUrl(TESTNET, "abc123")).toBe(
      "https://stellar.expert/explorer/testnet/tx/abc123",
    );
  });
});

describe("assets", () => {
  const usdc = getUsdc("testnet");

  it("uses Circle's testnet USDC issuer", () => {
    expect(usdc).toEqual({
      type: "credit",
      code: "USDC",
      issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    });
  });

  it("has no USDC configured for mainnet yet", () => {
    expect(() => getUsdc("public")).toThrow();
  });

  it("formats and compares assets", () => {
    expect(assetCode(XLM)).toBe("XLM");
    expect(assetCode(usdc)).toBe("USDC");
    expect(isSameAsset(XLM, { type: "native" })).toBe(true);
    expect(isSameAsset(XLM, usdc)).toBe(false);
    expect(isSameAsset(usdc, { ...usdc })).toBe(true);
    expect(isSameAsset(usdc, { type: "credit", code: "USDC", issuer: "GOTHER" })).toBe(false);
  });
});
