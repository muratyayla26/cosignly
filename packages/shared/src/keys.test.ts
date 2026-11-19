import { Keypair } from "@stellar/stellar-sdk/base";
import { describe, expect, it } from "vitest";

import {
  generateSignerKeypair,
  parseSecretKey,
  secretKeyErrorMessage,
  verifyKeypair,
  type SecretKeyParseError,
} from "./keys";

// A throwaway test key. Never use a real key in tests.
const TEST_KEY = Keypair.random();
const SECRET = TEST_KEY.secret();

describe("generateSignerKeypair", () => {
  it("creates distinct valid keys", () => {
    const a = generateSignerKeypair();
    const b = generateSignerKeypair();
    expect(a.publicKey()).toMatch(/^G[A-Z2-7]{55}$/);
    expect(a.secret()).toMatch(/^S[A-Z2-7]{55}$/);
    expect(a.publicKey()).not.toBe(b.publicKey());
  });
});

describe("parseSecretKey", () => {
  it("accepts a valid secret key", () => {
    const result = parseSecretKey(SECRET);
    expect(result.ok && result.keypair.publicKey()).toBe(TEST_KEY.publicKey());
  });

  it("ignores whitespace, line breaks and case", () => {
    const messy = `  ${SECRET.slice(0, 20).toLowerCase()}\n${SECRET.slice(20, 40)} ${SECRET.slice(40)}\t`;
    const result = parseSecretKey(messy);
    expect(result.ok && result.keypair.publicKey()).toBe(TEST_KEY.publicKey());
  });

  it.each<[string, SecretKeyParseError]>([
    ["", "empty"],
    ["   \n ", "empty"],
    [TEST_KEY.publicKey(), "public-key"],
    [SECRET.slice(0, -1), "invalid"],
    [`${SECRET.slice(0, -1)}${SECRET.endsWith("A") ? "B" : "A"}`, "invalid"], // bad checksum
    ["not a key", "invalid"],
  ])("rejects %j as %s", (input, error) => {
    expect(parseSecretKey(input)).toEqual({ ok: false, error });
  });

  it("never echoes the input in its error message", () => {
    const almost = SECRET.slice(0, -1);
    const result = parseSecretKey(almost);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(secretKeyErrorMessage(result.error)).not.toContain(almost);
  });
});

describe("secretKeyErrorMessage", () => {
  it.each<SecretKeyParseError>(["empty", "public-key", "invalid"])("has a message for %s", (e) => {
    expect(secretKeyErrorMessage(e).length).toBeGreaterThan(10);
  });
});

describe("verifyKeypair", () => {
  it("passes for the matching address", () => {
    expect(verifyKeypair(TEST_KEY, TEST_KEY.publicKey())).toBe(true);
  });

  it("fails for a different address", () => {
    expect(verifyKeypair(TEST_KEY, Keypair.random().publicKey())).toBe(false);
  });
});
