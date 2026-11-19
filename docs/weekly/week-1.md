# Cosignly — Week 1 update

**Sprint:** Instawards Sprint 1 · **Week:** 1 of 4 · **Dates:** 2026-11-17 → 2026-11-19
**Milestone:** https://github.com/muratyayla26/cosignly/milestone/1 · **Tag:** [`week-1`](https://github.com/muratyayla26/cosignly/releases/tag/week-1)

## Shipped this week
- W1.1 — Repo bootstrap: monorepo, TypeScript, lint, tests and CI on every pull request ([#6](https://github.com/muratyayla26/cosignly/pull/6))
- W1.2 — Shared core: testnet config, Horizon helpers, vault discovery by signer and the lockout rules (including the N-1 rule) with plain-language summaries ([#7](https://github.com/muratyayla26/cosignly/pull/7))
- W1.3 — Cosignly app on iPhone and Android: design system with light and dark themes, app icon and splash, network status ([#8](https://github.com/muratyayla26/cosignly/pull/8))
- W1.4 — Signer key: create or import on the phone, protected by Face ID / fingerprint; onboarding that explains recovery; Settings with QR code and appearance ([#9](https://github.com/muratyayla26/cosignly/pull/9))
- W1.5 — Vault discovery and dashboard: the app finds every vault the key can approve for, with balances, approval rules, signers and recent activity in plain language ([#10](https://github.com/muratyayla26/cosignly/pull/10))

Tested on an iPhone 16 (iOS 26) and a Galaxy A54 (Android 16), with a third signer simulated from the Stellar CLI.

## Evidence
- Demo / screen recording: _to be added_
- stellar.expert (testnet), 2-of-3 test vault found by both phones: https://stellar.expert/explorer/testnet/account/GDDTBEBLVLD32OEMRUEXH7KEHYK5VRVN6ZXAJF7NIWMUG3ATUGTCNLOL
- stellar.expert (testnet), 2-of-2 vault created from the CLI that appeared on the iPhone automatically: https://stellar.expert/explorer/testnet/account/GBS7QGG5CJ4JM46LZFW2Z6PLVBGN53OIN3TPVWBOT5HBWTJANI2QHDTP
- CI on `main`: https://github.com/muratyayla26/cosignly/actions/runs/44530257920
- Full list: [`docs/evidence.md`](../evidence.md)

## Plan vs. actual
On track. All five Week 1 tasks shipped and passed device testing on both phones. The Week 1 SOW output (biometric-protected signer key, automatic vault listing, dashboard with live testnet data) is met.

## Next week
- W2.1 — Vault setup wizard: templates (2/2, 2/3, 3/5) and custom rules, with lockout checks and the XLM reserve cost
- W2.2 — Create the vault on testnet in one transaction
- W2.3 — Plain-language transaction decoder
- W2.4 — Payment proposal (XLM / USDC) uploaded to Refractor
- W2.5 — Review and approve screen; automatic submission at the threshold

## Risks or help needed
- None. Testnet resets may remove the test vaults; they can be recreated from the CLI.
