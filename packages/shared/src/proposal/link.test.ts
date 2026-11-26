import { describe, expect, it } from "vitest";

import { parseProposalLink, proposalDeepLink, proposalShareMessage } from "./link";

const HASH = "a8d2412cda1bcdf00bd64c8f4fc3040e3b77a40e3bb9252f5ff21bac67f21449";

describe("proposal links", () => {
  it("reads a hash from every link form", () => {
    for (const input of [
      HASH,
      ` ${HASH.toUpperCase()}\n`,
      `cosignly://proposal/${HASH}`,
      `https://refractor.space/tx/${HASH}`,
      `https://www.refractor.space/tx/${HASH}?ref=chat`,
      proposalDeepLink(HASH),
    ]) {
      expect(parseProposalLink(input)).toBe(HASH);
    }
  });

  it("rejects anything else", () => {
    for (const input of [
      "",
      "hello",
      HASH.slice(1),
      `https://evil.example/tx/${HASH}`,
      `${HASH}x`,
    ]) {
      expect(parseProposalLink(input)).toBeNull();
    }
  });

  it("share text has both links", () => {
    expect(proposalShareMessage("Send 25 XLM to Taylor", HASH)).toBe(
      [
        "Please review and approve: Send 25 XLM to Taylor",
        `Open in Cosignly: cosignly://proposal/${HASH}`,
        `Or sign with another wallet on Refractor: https://refractor.space/tx/${HASH}`,
      ].join("\n"),
    );
  });
});
