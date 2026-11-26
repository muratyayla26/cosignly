import { describe, expect, it, vi } from "vitest";

import fx from "./__fixtures__/refractor.json";
import {
  createRefractorCoordinator,
  REFRACTOR_API_URL,
  RefractorError,
  refractorTxUrl,
  toCoordinatorStatus,
  type RefractorTx,
} from "./refractor";

// Real responses recorded on testnet, 2026-11-24 (see __fixtures__/refractor.json).
const HASH = fx.getProcessed.hash;
const ALEX = fx.postFirstSignature.signatures[0]?.key ?? "";
const SAM = fx.postSecondSignature.signatures[1]?.key ?? "";
const BEFORE_EXPIRY = new Date("2026-11-24T19:00:00Z");

function fakeFetch(...responses: [number, unknown][]) {
  const queue = [...responses];
  return vi.fn(async (_url: string, _init?: RequestInit) => {
    const [status, body] = queue.shift() ?? [500, null];
    return new Response(JSON.stringify(body), { status });
  });
}

const coordinator = (fetch: ReturnType<typeof fakeFetch>) =>
  createRefractorCoordinator({
    fetch: fetch as unknown as typeof globalThis.fetch,
    now: () => BEFORE_EXPIRY,
  });

describe("RefractorCoordinator", () => {
  it("propose: POSTs the signed envelope for testnet with auto-submit", async () => {
    const fetch = fakeFetch([200, fx.postFirstSignature]);
    const ref = await coordinator(fetch).propose({
      network: "testnet",
      xdr: "AAAA-signed",
      submitWhenReady: true,
      expiresAt: new Date(1796152103 * 1000),
    });
    expect(ref).toEqual({ network: "testnet", hash: HASH });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`${REFRACTOR_API_URL}/tx`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      network: "testnet",
      xdr: "AAAA-signed",
      submit: true,
      expires: 1796152103,
    });
  });

  it("getStatus: one signature collected → collecting", async () => {
    const status = await coordinator(fakeFetch([200, fx.getPending])).getStatus({
      network: "testnet",
      hash: HASH,
    });
    expect(status).toMatchObject({ state: "collecting", signedBy: [ALEX], hash: HASH });
    expect(status.maxTime).toEqual(new Date(1796152103 * 1000));
    expect(status.minTime).toBeUndefined();
  });

  it("addSignature: the second signature makes it ready", async () => {
    const status = await coordinator(fakeFetch([200, fx.postSecondSignature])).addSignature({
      network: "testnet",
      signedXdr: "AAAA-sam",
    });
    expect(status).toMatchObject({ state: "ready", signedBy: [ALEX, SAM] });
  });

  it("a signature from a key that can't sign is not counted", async () => {
    const status = await coordinator(fakeFetch([200, fx.postStrangerSignature])).addSignature({
      network: "testnet",
      signedXdr: "AAAA-stranger",
    });
    expect(status.signedBy).toEqual([ALEX]);
  });

  it("processed → submitted; failed carries the network's reason", async () => {
    const c = coordinator(fakeFetch([200, fx.getProcessed], [200, fx.getFailed]));
    expect((await c.getStatus({ network: "testnet", hash: HASH })).state).toBe("submitted");
    expect(await c.getStatus({ network: "testnet", hash: fx.getFailed.hash })).toMatchObject({
      state: "failed",
      error: "Tx error: txBadSeq",
    });
  });

  it("errors keep Refractor's message and status", async () => {
    const c = coordinator(
      fakeFetch([404, fx.notFound], [400, fx.postInvalidXdr], [400, fx.postExpired], [502, null]),
    );
    await expect(c.getStatus({ network: "testnet", hash: HASH })).rejects.toMatchObject({
      status: 404,
      message: fx.notFound.error,
    });
    await expect(
      c.propose({ network: "testnet", xdr: "x", submitWhenReady: true }),
    ).rejects.toMatchObject({ status: 400, message: "Invalid transaction XDR" });
    await expect(
      c.propose({ network: "testnet", xdr: "x", submitWhenReady: true }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("already expired") });
    await expect(c.getStatus({ network: "testnet", hash: HASH })).rejects.toBeInstanceOf(
      RefractorError,
    );
  });

  it("network failures become RefractorError with status 0", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("Network request failed");
    });
    const c = createRefractorCoordinator({ fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(c.getStatus({ network: "testnet", hash: HASH })).rejects.toMatchObject({
      status: 0,
    });
  });

  it("sends a callback URL only when given one", async () => {
    const fetch = fakeFetch([200, fx.postFirstSignature]);
    await coordinator(fetch).propose({
      network: "testnet",
      xdr: "x",
      submitWhenReady: false,
      callbackUrl: "https://cosignly-api.example/refractor",
    });
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      network: "testnet",
      xdr: "x",
      submit: false,
      callbackUrl: "https://cosignly-api.example/refractor",
    });
  });
});

describe("toCoordinatorStatus", () => {
  const pending = fx.getPending as RefractorTx;

  it("an unsubmitted proposal past its time bounds is expired", () => {
    const after = new Date((1796152103 + 1) * 1000);
    expect(toCoordinatorStatus("testnet", pending, after).state).toBe("expired");
    expect(toCoordinatorStatus("testnet", fx.getProcessed as RefractorTx, after).state).toBe(
      "submitted",
    );
  });

  it("processing counts as ready; unknown values never count as done", () => {
    expect(
      toCoordinatorStatus("testnet", { ...pending, status: "processing" }, BEFORE_EXPIRY).state,
    ).toBe("ready");
    expect(
      toCoordinatorStatus("testnet", { ...pending, status: "something-new" }, BEFORE_EXPIRY).state,
    ).toBe("collecting");
  });

  it("has a web link for co-signers", () => {
    expect(refractorTxUrl(HASH)).toBe(`https://refractor.space/tx/${HASH}`);
  });
});
