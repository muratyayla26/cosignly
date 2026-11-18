import { Keypair } from "@stellar/stellar-sdk/base";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cryptoSelfCheck } from "./selfcheck";

describe("cryptoSelfCheck", () => {
  afterEach(() => vi.restoreAllMocks());

  it("passes when randomness and Ed25519 work", () => {
    expect(cryptoSelfCheck()).toEqual({ ok: true });
  });

  it("reports a missing random source without throwing", () => {
    vi.spyOn(Keypair, "random").mockImplementation(() => {
      throw new Error("crypto.getRandomValues must be defined");
    });
    expect(cryptoSelfCheck()).toEqual({
      ok: false,
      error: "crypto.getRandomValues must be defined",
    });
  });

  it("reports a broken verifier", () => {
    vi.spyOn(Keypair.prototype, "verify").mockReturnValue(false);
    expect(cryptoSelfCheck()).toEqual({ ok: false, error: "signature did not verify" });
  });

  it("reports a verifier that accepts anything", () => {
    vi.spyOn(Keypair.prototype, "verify").mockReturnValue(true);
    expect(cryptoSelfCheck()).toEqual({ ok: false, error: "tampered message verified" });
  });

  it("reports an invalid generated key", () => {
    vi.spyOn(Keypair.prototype, "publicKey").mockReturnValue("GBAD");
    expect(cryptoSelfCheck()).toEqual({ ok: false, error: "generated key is invalid" });
  });

  it("handles non-Error throws", () => {
    vi.spyOn(Keypair, "random").mockImplementation(() => {
      throw "boom";
    });
    expect(cryptoSelfCheck()).toEqual({ ok: false, error: "unknown error" });
  });
});
