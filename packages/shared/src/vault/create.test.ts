import { Keypair, TransactionBuilder, type Transaction } from "@stellar/stellar-sdk/base";
import { describe, expect, it, vi } from "vitest";

import { getUsdc } from "../assets";
import {
  TransactionSubmitError,
  toAccountInfo,
  type AccountInfo,
  type HorizonClient,
} from "../horizon/client";
import type { HorizonAccount } from "../horizon/types";
import { TESTNET, type NetworkConfig } from "../network";
import setupAccount from "./__fixtures__/setup-account.json";
import setupTransaction from "./__fixtures__/setup-transaction.json";
import {
  buildVaultSetupTransaction,
  compareVaultAccount,
  startVaultCreation,
  VaultCreationError,
} from "./create";
import { equalWeightConfig } from "./setup";

// Real testnet keys: Alex, Sam, Jordan. The fixtures are the 2-of-3 vault created
// by create.live.test.ts on 2026-11-22 (tx 6f0a330c…1f1a).
const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const SAM = "GDGKPPMM5BORTIJLY2IC2OCU33OACYDRHMOUJAFRXHY4GTYOJD2QT4CY";
const JORDAN = "GDCHQZAQROW52J3O7WJUTFQMCB6HB7TJXVV33LPJS5PIHG3X5H55TXR5";
const VAULT = "GDQMJCBAHXJPIPXGIZH63TYOAFOZW3GO3IVWN6STSAWU2BV7YRTNZQA6";

const USDC = getUsdc("testnet");
const config = equalWeightConfig([ALEX, SAM, JORDAN], 2, 2);
const onChain = toAccountInfo(setupAccount as HorizonAccount);

describe("buildVaultSetupTransaction", () => {
  const tx = buildVaultSetupTransaction({
    accountId: VAULT,
    sequence: "100",
    config,
    usdc: USDC,
    network: TESTNET,
  });

  it("puts trustline, signers and then thresholds + master weight 0 in one transaction", () => {
    expect(tx.source).toBe(VAULT);
    expect(tx.sequence).toBe("101");
    expect(tx.operations.map((op) => op.type)).toEqual([
      "changeTrust",
      "setOptions",
      "setOptions",
      "setOptions",
      "setOptions",
    ]);
    const [trust, ...rest] = tx.operations;
    expect(trust).toMatchObject({
      line: { code: "USDC", issuer: USDC.type === "credit" ? USDC.issuer : "" },
    });
    const last = rest.pop();
    expect(rest.map((op) => (op as { signer: unknown }).signer)).toEqual([
      { ed25519PublicKey: ALEX, weight: 1 },
      { ed25519PublicKey: SAM, weight: 1 },
      { ed25519PublicKey: JORDAN, weight: 1 },
    ]);
    expect(last).toMatchObject({
      masterWeight: 0,
      lowThreshold: 2,
      medThreshold: 2,
      highThreshold: 2,
    });
    expect(last).not.toHaveProperty("signer");
  });

  it("has time bounds and a capped fee", () => {
    const max = Number(tx.timeBounds?.maxTime);
    expect(max - Date.now() / 1000).toBeGreaterThan(250);
    expect(max - Date.now() / 1000).toBeLessThanOrEqual(300);
    expect(tx.fee).toBe(String(1000 * 5));
  });

  it("matches the shape of the real testnet setup transaction", () => {
    const real = TransactionBuilder.fromXDR(
      setupTransaction.envelope_xdr,
      TESTNET.passphrase,
    ) as Transaction;
    expect(real.source).toBe(VAULT);
    expect(real.operations.map((op) => op.type)).toEqual(tx.operations.map((op) => op.type));
    expect(real.operations.at(-1)).toMatchObject({ masterWeight: 0, highThreshold: 2 });
  });

  it("refuses configs that are not valid Cosignly vaults", () => {
    const input = { accountId: VAULT, sequence: "1", usdc: USDC, network: TESTNET };
    expect(() =>
      buildVaultSetupTransaction({ ...input, config: { ...config, masterWeight: 1 } }),
    ).toThrow(/master weight 0/);
    expect(() =>
      buildVaultSetupTransaction({ ...input, config: equalWeightConfig([ALEX, SAM], 2, 3) }),
    ).toThrow(/lockout rules/);
    expect(() =>
      buildVaultSetupTransaction({ ...input, config, usdc: { type: "native" } }),
    ).toThrow(/issued asset/);
  });
});

describe("compareVaultAccount", () => {
  it("the real vault matches its configuration", () => {
    expect(compareVaultAccount(onChain, config, USDC)).toEqual([]);
  });

  it("reports each difference", () => {
    const wrong: AccountInfo = {
      ...onChain,
      masterWeight: 1,
      thresholds: { low: 1, medium: 2, high: 2 },
      signers: onChain.signers.slice(0, 2),
      balances: onChain.balances.filter((b) => b.asset.type === "native"),
    };
    expect(compareVaultAccount(wrong, config, USDC)).toEqual([
      "master weight",
      "thresholds",
      "signers",
      "USDC trustline",
    ]);
  });
});

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** In-memory testnet: Friendbot creates the account, submit applies the transaction. */
function fakeNetwork() {
  const accounts = new Map<string, AccountInfo>();
  const submitted: Transaction[] = [];
  let failNextSubmit: Error | null = null;
  let loseNextResponse = false;

  const friendbot = vi.fn(async (url: string) => {
    const id = new URL(url).searchParams.get("addr") ?? "";
    accounts.set(id, {
      ...onChain,
      id,
      sequence: "1000",
      masterWeight: 1,
      thresholds: { low: 0, medium: 0, high: 0 },
      signers: [],
      subentryCount: 0,
      balances: onChain.balances.filter((b) => b.asset.type === "native"),
    });
    return new Response("{}", { status: 200 });
  });

  const horizon = {
    getAccount: vi.fn(async (id: string) => accounts.get(id) ?? null),
    submitTransaction: vi.fn(async (xdr: string) => {
      if (failNextSubmit) {
        const e = failNextSubmit;
        failNextSubmit = null;
        throw e;
      }
      const tx = TransactionBuilder.fromXDR(xdr, TESTNET.passphrase) as Transaction;
      // SDK 17: DecoratedSignature fields are plain properties, not methods.
      const signature = tx.signatures[0]?.signature;
      expect(signature && Keypair.fromPublicKey(tx.source).verify(tx.hash(), signature)).toBe(true);
      submitted.push(tx);
      accounts.set(tx.source, { ...onChain, id: tx.source });
      if (loseNextResponse) {
        loseNextResponse = false;
        throw new TypeError("Network request failed");
      }
      return { hash: hex(tx.hash()), ledger: 1 };
    }),
  } as unknown as HorizonClient;

  return {
    horizon,
    friendbot,
    submitted,
    accounts,
    failSubmit: (e: Error) => (failNextSubmit = e),
    loseResponse: () => (loseNextResponse = true),
  };
}

const start = (net: ReturnType<typeof fakeNetwork>) =>
  startVaultCreation({
    config,
    usdc: USDC,
    network: TESTNET,
    horizon: net.horizon,
    fetch: net.friendbot as unknown as typeof fetch,
  });

describe("startVaultCreation", () => {
  it("funds, configures in one signed transaction and verifies", async () => {
    const net = fakeNetwork();
    const creation = start(net);
    const steps: string[] = [];
    const result = await creation.run((s) => steps.push(s));

    expect(steps).toEqual(["fund", "configure", "verify"]);
    expect(result.accountId).toBe(creation.accountId);
    expect(result.txHash).toMatch(/^[0-9a-f]{64}$/);
    expect(net.friendbot).toHaveBeenCalledWith(
      `https://friendbot.stellar.org?addr=${creation.accountId}`,
    );
    expect(net.submitted).toHaveLength(1);
    expect(net.submitted[0]?.sequence).toBe("1001");
  });

  it("never exposes the setup key", async () => {
    const net = fakeNetwork();
    const creation = start(net);
    const result = await creation.run();
    const secrets = /S[A-Z2-7]{55}/;
    expect(JSON.stringify(result)).not.toMatch(secrets);
    expect(JSON.stringify(creation)).not.toMatch(secrets);
    expect(Object.keys(creation)).toEqual(["accountId", "run"]);
  });

  it("resumes after a rejected transaction without asking Friendbot again", async () => {
    const net = fakeNetwork();
    const creation = start(net);
    net.failSubmit(
      new TransactionSubmitError(400, {
        extras: { result_codes: { transaction: "tx_bad_seq" } },
      }),
    );
    const error = await creation.run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(VaultCreationError);
    expect(error).toMatchObject({ step: "configure", resultCodes: { transaction: "tx_bad_seq" } });

    const steps: string[] = [];
    await creation.run((s) => steps.push(s));
    expect(steps).toEqual(["configure", "verify"]);
    expect(net.friendbot).toHaveBeenCalledTimes(1);
  });

  it("does not submit twice when an earlier response was lost", async () => {
    const net = fakeNetwork();
    const creation = start(net);
    net.loseResponse();
    await expect(creation.run()).rejects.toMatchObject({ step: "configure" });

    const result = await creation.run();
    expect(net.submitted).toHaveLength(1);
    expect(result.txHash).toBeUndefined();
  });

  it("reports a Friendbot failure, unless the account was funded anyway", async () => {
    const down = fakeNetwork();
    down.friendbot.mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(start(down).run()).rejects.toMatchObject({ step: "fund" });

    const offline = fakeNetwork();
    offline.friendbot.mockRejectedValueOnce(new TypeError("Network request failed"));
    await expect(start(offline).run()).rejects.toMatchObject({
      step: "fund",
      message: "Couldn't reach Friendbot to fund the vault.",
    });

    const lost = fakeNetwork();
    const real = lost.friendbot.getMockImplementation();
    lost.friendbot.mockImplementationOnce(async (url: string) => {
      await real?.(url);
      return new Response("", { status: 504 });
    });
    await expect(start(lost).run()).resolves.toMatchObject({ txHash: expect.any(String) });
  });

  it("fails verification when the account doesn't match", async () => {
    const net = fakeNetwork();
    const creation = start(net);
    vi.mocked(net.horizon.submitTransaction).mockImplementationOnce(async (xdr: string) => {
      const tx = TransactionBuilder.fromXDR(xdr, TESTNET.passphrase) as Transaction;
      net.accounts.set(tx.source, { ...onChain, id: tx.source, masterWeight: 1 });
      return { hash: "ab".repeat(32), ledger: 1 };
    });
    await expect(creation.run()).rejects.toMatchObject({
      step: "verify",
      message: "The vault on Stellar doesn't match the setup (master weight).",
    });
  });

  it("turns unexpected errors into a step error", async () => {
    const net = fakeNetwork();
    vi.mocked(net.horizon.getAccount).mockRejectedValueOnce(new TypeError("offline"));
    await expect(start(net).run()).rejects.toMatchObject({
      step: "configure",
      message: "Couldn't reach Stellar. Check your connection and try again.",
    });
  });

  it("refuses invalid configs and networks without Friendbot", async () => {
    const net = fakeNetwork();
    expect(() =>
      startVaultCreation({
        config: equalWeightConfig([ALEX], 2, 2),
        usdc: USDC,
        network: TESTNET,
        horizon: net.horizon,
      }),
    ).toThrow();
    const noFriendbot: NetworkConfig = { ...TESTNET };
    delete noFriendbot.friendbotUrl;
    const creation = startVaultCreation({
      config,
      usdc: USDC,
      network: noFriendbot,
      horizon: net.horizon,
    });
    await expect(creation.run()).rejects.toMatchObject({ step: "fund" });
  });
});
