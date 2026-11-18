<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/lockup-horizontal-on-dark.png">
    <img alt="Cosignly" src="assets/brand/lockup-horizontal-on-light.png" width="320">
  </picture>
</p>

# Cosignly

**Mobile approvals for teams that protect shared funds with Stellar multisig.**

A team's shared Stellar account (a *vault*) can require, for example, 2 of 3 signers to approve every payment. Cosignly makes that workable day to day:

1. Sam proposes "Send 500 USDC to Alex" from the app.
2. Jordan gets a push notification, sees the payment in plain language ("Team Vault → Alex, 500 USDC, 1 of 2 approvals") and approves with Face ID or fingerprint.
3. When the threshold is reached, the payment is submitted to the network automatically and everyone is notified.

> **Status:** in active development (Sprint 1, Stellar testnet only). Not ready for real funds.

## Why

Today, multisig on Stellar usually means passing transaction links around in chat and asking people to sign raw XDR they cannot read. Cosignly adds what is missing:

- **Mobile first**, with push notifications when your approval is needed.
- **Readable approvals** — you see what you sign, technical details are one tap away.
- **Lockout-safe setup** — the vault wizard blocks signer/threshold combinations that could lock the account.
- **Non-custodial** — Cosignly never holds keys or funds.

## How it works

- A vault is a normal Stellar account protected by Stellar's built-in multisig (signer weights and thresholds). Funds stay on the network, not in Cosignly.
- Each member has a signer key on their phone. The Ed25519 signing key is encrypted and stored in the iOS Keychain / Android Keystore, protected by biometrics (Secure Enclave / hardware-backed keystore). It is decrypted on the device only after biometric confirmation to sign a transaction, and is never sent to the backend.
- Signatures are collected through [Refractor](https://refractor.space), the ecosystem's signature aggregator. If Cosignly ever disappears, vaults remain fully usable with Refractor, Stellar Lab or any other Stellar tool.
- A small backend (Cloudflare Workers + D1) keeps a per-vault index of pending proposals and sends push notifications. It stores metadata only.

```
Cosignly app (iOS / Android, Expo)
 ├─ Horizon            accounts, signers, thresholds, balances, history
 ├─ Refractor          upload proposals, merge signatures, submit at threshold
 └─ Cosignly API       signer auth, push tokens, proposal index, push delivery
    (Cloudflare Worker + D1 + Cron)
```

## Repository layout

| Path | What |
|---|---|
| `apps/mobile` | The iOS and Android app (Expo) |
| `apps/api` | The backend (Cloudflare Worker + D1) |
| `packages/shared` | Types, vault rules, transaction decoding and Stellar helpers shared by the app and the API |
| `docs/` | Plan, design language, decisions, evidence |
| `assets/brand/` | Logo, app icons and splash images |

## Development

Requirements: Node 24 (see `.nvmrc`), pnpm 12.

```bash
pnpm install
pnpm check        # format check, lint, typecheck, test — the same as CI
```

App and API setup instructions will be added as those packages land (see [`docs/plan.md`](docs/plan.md)).

## Funding

Cosignly Sprint 1 is supported by the Stellar Development Foundation's Instawards program through the Stellar Türkiye Ambassador Chapter.

## Contributing

This project is not accepting external contributions at this time. See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security issue, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
