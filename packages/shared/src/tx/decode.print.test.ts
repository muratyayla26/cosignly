import { describe, it } from "vitest";

import { getUsdc } from "../assets";
import { explorerTransactionUrl, TESTNET } from "../network";
import setupTransaction from "../vault/__fixtures__/setup-transaction.json";
import fixtures from "./__fixtures__/transactions.json";
import { decodeTransaction } from "./decode";

// Opt-in: prints what the decoder shows for each real testnet fixture, next to its
// stellar.expert link, so a person can compare the two.
//   DECODE_PRINT=1 pnpm --filter @cosignly/shared exec vitest run decode.print --silent=false
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

describe.skipIf(!env?.DECODE_PRINT)("decoder output for the fixtures", () => {
  it("prints each fixture", () => {
    const { alex, sam } = fixtures.accounts;
    const all = [
      ...fixtures.transactions,
      {
        id: "vault-setup (W2.2)",
        description: "2-of-3 vault setup",
        submitted: true,
        hash: setupTransaction.hash,
        envelope_xdr: setupTransaction.envelope_xdr,
      },
    ];

    const blocks = all.map((t) => {
      const result = decodeTransaction(t.envelope_xdr, {
        network: TESTNET,
        usdc: getUsdc("testnet"),
        labels: { [alex]: "Alex", [sam]: "Sam" },
      });
      if (!result.ok) return `${t.id}: could not decode (${result.error})`;
      const tx = result.tx;
      const actions = tx.operations.flatMap((op, i) =>
        (op.lines.length > 0 ? op.lines : [op.text]).map(
          (line, j) =>
            `${j === 0 ? `${i + 1}.` : "  "} ${line}${op.flags.length ? `  [${op.flags.join(", ")}]` : ""}`,
        ),
      );
      return [
        `── ${t.id}`,
        `   ${t.submitted ? explorerTransactionUrl(TESTNET, t.hash) : "(not submitted, so no stellar.expert page)"}`,
        `   Title:       ${tx.title}`,
        `   Actions:`,
        ...actions.map((a) => `     ${a}`),
        `   Memo:        ${tx.memo ? `${tx.memo.value} (${tx.memo.type})` : "none"}`,
        `   Valid until: ${tx.validUntil ? tx.validUntil.toISOString().replace("T", " ").slice(0, 16) + " UTC" : "no expiry"}`,
        `   Warnings:    ${tx.warnings.length ? tx.warnings.join("\n                ") : "none"}`,
      ].join("\n");
    });

    console.info(`\n${blocks.join("\n\n")}\n`);
  });
});
