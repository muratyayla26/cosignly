import { refractorTxUrl } from "../coordinator/refractor";

/**
 * Links to a proposal. A proposal is identified by its transaction hash, so a
 * link is just that hash in one of these forms:
 * - `cosignly://proposal/<hash>` opens it in Cosignly (also used by push notifications in W3).
 * - `https://refractor.space/tx/<hash>` opens it on Refractor, where signers
 *   using other wallets can sign.
 * - the bare 64-character hash.
 */

export function proposalDeepLink(hash: string): string {
  // Same value as DEEP_LINK_SCHEME in index.ts (kept literal to avoid an import cycle).
  return `cosignly://proposal/${hash}`;
}

/** The proposal hash in a pasted link or hash, or `null` if there is none. */
export function parseProposalLink(input: string): string | null {
  const text = input.trim();
  if (/^[0-9a-f]{64}$/i.test(text)) return text.toLowerCase();
  const match =
    /^(?:cosignly:\/\/proposal\/|https?:\/\/(?:www\.)?refractor\.space\/tx\/)([0-9a-f]{64})(?:[/?#].*)?$/i.exec(
      text,
    );
  return match?.[1] ? match[1].toLowerCase() : null;
}

/** Text to share with co-signers: the Cosignly link plus the Refractor page for other wallets. */
export function proposalShareMessage(title: string, hash: string): string {
  return [
    `Please review and approve: ${title}`,
    `Open in Cosignly: ${proposalDeepLink(hash)}`,
    `Or sign with another wallet on Refractor: ${refractorTxUrl(hash)}`,
  ].join("\n");
}
