import { describe, expect, it, vi } from "vitest";

import { TESTNET } from "../network";
import { validateVaultConfig } from "../vault/rules";
import { describeThresholds } from "../vault/describe";
import { createHorizonClient, HorizonError, toAccountInfo } from "./client";
import type { HorizonAccount } from "./types";
// Real responses from horizon-testnet.stellar.org (2026-11-18) for a 2-of-3
// vault created with the Stellar CLI. Testnet resets may remove the account.
import accountsBySigner from "./__fixtures__/accounts-by-signer.json";
import root from "./__fixtures__/root.json";
import vaultAccount from "./__fixtures__/vault-account.json";

const VAULT = "GDDTBEBLVLD32OEMRUEXH7KEHYK5VRVN6ZXAJF7NIWMUG3ATUGTCNLOL";
const ALEX = "GCFA5GKYNJDLCLHLGJMYKBASQ2JNN43T67MS6GALL6CGKEPMSELOORJ7";
const SAM = "GDGKPPMM5BORTIJLY2IC2OCU33OACYDRHMOUJAFRXHY4GTYOJD2QT4CY";
const JORDAN = "GDCHQZAQROW52J3O7WJUTFQMCB6HB7TJXVV33LPJS5PIHG3X5H55TXR5";
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function mockFetch(...responses: Response[]) {
  const fn = vi.fn<typeof fetch>();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  return fn;
}

const page = (
  records: unknown[],
  next = "https://horizon-testnet.stellar.org/accounts?cursor=X",
) => ({
  _links: { next: { href: next } },
  _embedded: { records },
});

describe("toAccountInfo (real vault fixture)", () => {
  const info = toAccountInfo(vaultAccount as HorizonAccount);

  it("separates the turned-off master key from the signers", () => {
    expect(info.id).toBe(VAULT);
    expect(info.masterWeight).toBe(0);
    expect(info.signers).toHaveLength(3);
    expect(info.signers.map((s) => s.key).sort()).toEqual([ALEX, JORDAN, SAM].sort());
    expect(info.signers.every((s) => s.weight === 1)).toBe(true);
    expect(info.otherSigners).toEqual([]);
  });

  it("maps thresholds and balances", () => {
    expect(info.thresholds).toEqual({ low: 1, medium: 2, high: 2 });
    expect(info.subentryCount).toBe(4); // 3 signers + 1 trustline
    expect(info.balances).toEqual([
      {
        asset: { type: "credit", code: "USDC", issuer: USDC_ISSUER },
        balance: "0.0000000",
        limit: "922337203685.4775807",
      },
      { asset: { type: "native" }, balance: expect.any(String) },
    ]);
  });

  it("produces a config that passes the lockout rules and reads as 2 of 3", () => {
    expect(validateVaultConfig(info).issues).toEqual([]);
    expect(describeThresholds(info).summary).toBe(
      "Payments need 2 of 3. Changing signers needs 2 of 3.",
    );
  });

  it("keeps unsupported signer types aside and drops liquidity pool shares", () => {
    const raw: HorizonAccount = {
      ...(vaultAccount as HorizonAccount),
      signers: [
        { key: ALEX, weight: 1, type: "ed25519_public_key" },
        { key: SAM, weight: 0, type: "ed25519_public_key" },
        { key: "XABC", weight: 1, type: "sha256_hash" },
      ],
      balances: [
        { asset_type: "liquidity_pool_shares", balance: "1.0000000" },
        { asset_type: "native", balance: "5.0000000" },
      ],
    };
    const result = toAccountInfo(raw);
    expect(result.masterWeight).toBe(0); // master key not listed at all
    expect(result.signers).toEqual([{ key: ALEX, weight: 1 }]);
    expect(result.otherSigners).toEqual([{ key: "XABC", weight: 1, type: "sha256_hash" }]);
    expect(result.balances).toEqual([{ asset: { type: "native" }, balance: "5.0000000" }]);
  });
});

describe("createHorizonClient", () => {
  it("loads an account", async () => {
    const fetch = mockFetch(json(vaultAccount));
    const client = createHorizonClient({ network: TESTNET, fetch });
    const account = await client.getAccount(VAULT);
    expect(account?.id).toBe(VAULT);
    expect(fetch).toHaveBeenCalledWith(
      `https://horizon-testnet.stellar.org/accounts/${VAULT}`,
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("returns null for an account that does not exist", async () => {
    const client = createHorizonClient({
      network: TESTNET,
      fetch: mockFetch(json({ status: 404, title: "Resource Missing" }, 404)),
    });
    expect(await client.getAccount(VAULT)).toBeNull();
  });

  it("throws HorizonError with Horizon's problem details", async () => {
    const problem = { status: 500, title: "Internal Server Error", detail: "Something broke." };
    const client = createHorizonClient({ network: TESTNET, fetch: mockFetch(json(problem, 500)) });
    const error = await client.getAccount(VAULT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HorizonError);
    expect(error).toMatchObject({ status: 500, message: "Something broke.", problem });
  });

  it("handles error responses without a JSON body", async () => {
    const client = createHorizonClient({
      network: TESTNET,
      fetch: mockFetch(new Response("Bad gateway", { status: 502 })),
    });
    await expect(client.getAccount(VAULT)).rejects.toMatchObject({
      status: 502,
      message: "Horizon request failed with status 502",
    });
  });

  it("rejects malformed keys before calling Horizon", async () => {
    const fetch = mockFetch();
    const client = createHorizonClient({ network: TESTNET, fetch });
    await expect(client.getAccount("GNOTAKEY")).rejects.toThrow(TypeError);
    await expect(client.findAccountsBySigner("nope")).rejects.toThrow(TypeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("passes an abort signal through", async () => {
    const fetch = mockFetch(json(vaultAccount));
    const controller = new AbortController();
    await createHorizonClient({ network: TESTNET, fetch }).getAccount(VAULT, {
      signal: controller.signal,
    });
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
  });
});

describe("findAccountsBySigner / discoverVaults", () => {
  it("finds the vault from a signer key (real fixture)", async () => {
    const fetch = mockFetch(json(accountsBySigner));
    const client = createHorizonClient({ network: TESTNET, fetch });
    const vaults = await client.discoverVaults(ALEX);
    expect(vaults).toEqual([
      expect.objectContaining({ kind: "classic", accountId: VAULT, masterWeight: 0 }),
    ]);
    expect(fetch.mock.calls[0]?.[0]).toBe(
      `https://horizon-testnet.stellar.org/accounts?signer=${ALEX}&limit=200&order=asc`,
    );
  });

  it("stops after a short page even though Horizon always sends a next link", async () => {
    const fetch = mockFetch(json(page([vaultAccount])));
    await createHorizonClient({ network: TESTNET, fetch }).findAccountsBySigner(ALEX, { limit: 2 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("follows next links while pages are full, up to maxPages", async () => {
    const full = () =>
      json(page([vaultAccount, vaultAccount], "https://horizon-testnet.stellar.org/next"));
    const fetch = mockFetch(full(), full(), full());
    const accounts = await createHorizonClient({ network: TESTNET, fetch }).findAccountsBySigner(
      ALEX,
      { limit: 2, maxPages: 2 },
    );
    expect(accounts).toHaveLength(4);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]?.[0]).toBe("https://horizon-testnet.stellar.org/next");
  });

  it("clamps the page size to Horizon's 1-200 range", async () => {
    const fetch = mockFetch(json(page([])), json(page([])));
    const client = createHorizonClient({ network: TESTNET, fetch });
    await client.findAccountsBySigner(ALEX, { limit: 500 });
    await client.findAccountsBySigner(ALEX, { limit: 0 });
    expect(fetch.mock.calls[0]?.[0]).toContain("limit=200");
    expect(fetch.mock.calls[1]?.[0]).toContain("limit=1");
  });

  it("excludes the signer's own account from vaults", async () => {
    const own = { ...vaultAccount, id: ALEX, account_id: ALEX };
    const fetch = mockFetch(json(page([own, vaultAccount])));
    const vaults = await createHorizonClient({ network: TESTNET, fetch }).discoverVaults(ALEX);
    expect(vaults.map((v) => v.accountId)).toEqual([VAULT]);
  });

  it("strips a trailing slash from the Horizon URL", async () => {
    const fetch = mockFetch(json(page([])));
    const network = { ...TESTNET, horizonUrl: "https://horizon.example/" };
    await createHorizonClient({ network, fetch }).findAccountsBySigner(ALEX);
    expect(fetch.mock.calls[0]?.[0]).toMatch(/^https:\/\/horizon\.example\/accounts\?/);
  });
});

describe("getNetworkStatus", () => {
  it("reports a healthy testnet (real fixture)", async () => {
    const fetch = mockFetch(json(root));
    const status = await createHorizonClient({ network: TESTNET, fetch }).getNetworkStatus();
    expect(fetch.mock.calls[0]?.[0]).toBe("https://horizon-testnet.stellar.org/");
    expect(status).toEqual({
      ok: true,
      passphraseMatches: true,
      latestLedger: root.history_latest_ledger,
      latestLedgerClosedAt: new Date(root.history_latest_ledger_closed_at),
      protocolVersion: root.current_protocol_version,
    });
  });

  it("flags a Horizon server on a different network", async () => {
    const other = { ...root, network_passphrase: "Public Global Stellar Network ; September 2015" };
    const status = await createHorizonClient({
      network: TESTNET,
      fetch: mockFetch(json(other)),
    }).getNetworkStatus();
    expect(status).toMatchObject({ ok: false, passphraseMatches: false });
  });
});
