# Cosignly — Week 2 update

**Sprint:** Instawards Sprint 1 · **Week:** 2 of 4 · **Dates:** 2026-11-22 → 2026-11-28
**Milestone:** https://github.com/muratyayla26/cosignly/milestone/2 · **Tag:** [`week-2`](https://github.com/muratyayla26/cosignly/releases/tag/week-2)

## Shipped this week
- W2.1 — Vault setup wizard: name, signers (paste or QR scan), approval rules (2/2, 2/3, 3/5 or custom weights) and a review screen. Setups that could lock the vault can't be submitted; risky ones (N-1 rule) need an explicit tick. The XLM the vault must keep is shown ([#18](https://github.com/muratyayla26/cosignly/pull/18))
- W2.2 — Create the vault on testnet in one transaction: USDC trustline, signers, thresholds and the vault's own key turned off. The one-time setup key never leaves the phone's memory ([#19](https://github.com/muratyayla26/cosignly/pull/19))
- W2.3 — Plain-language transaction decoder, tested on real testnet transactions; anything it can't read is flagged in red ([#20](https://github.com/muratyayla26/cosignly/pull/20))
- W2.4 — Payment proposals (XLM / USDC): recipient and balance checks, 7-day expiry, signed with Face ID / fingerprint and uploaded to Refractor ([#21](https://github.com/muratyayla26/cosignly/pull/21))
- W2.5 — Review and approve: readable approval screen with each signer's status, approval with biometrics, automatic submission when enough signers approve, a share link for co-signers using other wallets ([#22](https://github.com/muratyayla26/cosignly/pull/22))

Tested on an iPhone 16 (iOS 26) and a Galaxy A54 (Android 16), with a third signer from the Stellar CLI.

## Evidence
- Screenshots: payment form (iPhone), approval screen at 1 of 2 (Android), Sent (iPhone) — in the report sent to the Chapter Lead
- stellar.expert (testnet), vault created from the app (2-of-3): https://stellar.expert/explorer/testnet/account/GCTABDKBN34FA5WTRB5IMUUW3YNQHFT6KXESTA2PPQJRU5WIC2V2ESZ2
- stellar.expert (testnet), payment proposed on the iPhone, approved on Android, sent automatically: https://stellar.expert/explorer/testnet/tx/42ec796b958e17070b984dc42a08666c921deab179e31651ffc052709232765f
- Refractor, the same payment with both signatures: https://refractor.space/tx/42ec796b958e17070b984dc42a08666c921deab179e31651ffc052709232765f
- Full list: [`docs/evidence.md`](../evidence.md)

## Plan vs. actual
On track. All five Week 2 tasks shipped and passed device testing on both phones. The Week 2 SOW output is met: a 2-of-3 vault created from the app on testnet, and a proposal on Refractor that completed with a second phone's approval.

Two findings were fixed during testing: Android's keyboard handling with edge-to-edge screens (W2.1), and a few seconds' delay in Refractor's status that briefly showed a sent payment as outdated (W2.5).

## Next week
- W3.1 — Cosignly API on Cloudflare Workers + D1: public health URL, sign-in by signed challenge (no keys or funds on the server)
- W3.2 — Push token registration and a proposal index per vault, checked against Stellar
- W3.3 — Refractor callback, scheduled status checks, "Approval needed" and "Executed" push notifications
- W3.4 — Notifications in the app: tapping one opens the right proposal on iPhone and Android
- W3.5 — Proposal lifecycle across all signers' phones: sent, failed, expired, outdated (propose again); one pending proposal per vault

## Risks or help needed
- None. Week 3 needs a Firebase project (Android push) and an Apple push key; both are on the developer's side.
