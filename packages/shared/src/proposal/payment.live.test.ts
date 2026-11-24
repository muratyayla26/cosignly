import { Keypair, TransactionBuilder, type Transaction } from "@stellar/stellar-sdk/base";
import { describe, expect, it } from "vitest";

import { getUsdc } from "../assets";
import { createRefractorCoordinator, refractorTxUrl } from "../coordinator/refractor";
import { createHorizonClient } from "../horizon/client";
import { explorerTransactionUrl, TESTNET } from "../network";
import { startVaultCreation } from "../vault/create";
import { equalWeightConfig } from "../vault/setup";
import { approvalProgress, buildPaymentProposal } from "./payment";

// Opt-in end-to-end run on testnet with throw-away keys:
// 2-of-2 vault → payment proposal signed by Alex → Refractor (1 signature)
// → Sam adds his signature → Refractor submits it.
//   PROPOSAL_LIVE=1 pnpm --filter @cosignly/shared test:live
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!env?.PROPOSAL_LIVE)("live payment proposal (testnet + Refractor)", () => {
  it("collects two signatures and is submitted", async () => {
    const horizon = createHorizonClient({ network: TESTNET });
    const refractor = createRefractorCoordinator();
    const usdc = getUsdc("testnet");
    const alex = Keypair.random();
    const sam = Keypair.random();
    const config = equalWeightConfig([alex.publicKey(), sam.publicKey()], 2, 2);

    // Vault, and a recipient (another freshly created vault is an existing account).
    const { accountId } = await startVaultCreation({
      config,
      usdc,
      network: TESTNET,
      horizon,
    }).run();
    const recipient = await startVaultCreation({
      config: equalWeightConfig([Keypair.random().publicKey(), sam.publicKey()], 2, 2),
      usdc,
      network: TESTNET,
      horizon,
    }).run();
    const vault = await horizon.getAccount(accountId);
    if (!vault) throw new Error("vault missing");

    const tx = buildPaymentProposal({
      vault,
      draft: {
        asset: "XLM",
        destination: recipient.accountId,
        amount: "10",
        memo: "Cosignly test",
      },
      usdc,
      network: TESTNET,
    });
    tx.sign(alex);
    const ref = await refractor.propose({
      network: "testnet",
      xdr: tx.toXDR(),
      submitWhenReady: true,
      ...(tx.timeBounds ? { expiresAt: new Date(Number(tx.timeBounds.maxTime) * 1000) } : {}),
    });
    const first = await refractor.getStatus(ref);
    expect(first.state).toBe("collecting");
    expect(approvalProgress(config, first.signedBy)).toMatchObject({ approvals: 1, required: 2 });
    console.info(`proposal ${refractorTxUrl(ref.hash)}`);

    const samCopy = TransactionBuilder.fromXDR(first.xdr, TESTNET.passphrase) as Transaction;
    samCopy.sign(sam);
    const second = await refractor.addSignature({
      network: ref.network,
      signedXdr: samCopy.toXDR(),
    });
    expect(second.state).toBe("ready");

    let state = second.state;
    for (let i = 0; i < 30 && state !== "submitted" && state !== "failed"; i++) {
      await sleep(2000);
      state = (await refractor.getStatus(ref)).state;
    }
    expect(state).toBe("submitted");
    console.info(`executed ${explorerTransactionUrl(TESTNET, ref.hash)}`);
  }, 120_000);
});
