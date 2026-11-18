# 0002 — Fetch-based Horizon client in `packages/shared`

- **Status:** Accepted
- **Date:** 2026-11-18 (W1.2)

## Context

Both the mobile app (React Native) and the API (Cloudflare Workers) read accounts, signers, thresholds and balances from Horizon. `@stellar/stellar-sdk` ships `Horizon.Server`, which pulls in an HTTP client (axios / feaxios) and wraps every response in its own classes. Cosignly needs only a handful of read endpoints.

`@stellar/stellar-base` is deprecated and now lives inside the SDK as the `@stellar/stellar-sdk/base` entry point, which has no HTTP client.

## Decision

- `packages/shared` depends on `@stellar/stellar-sdk` (pinned) and imports only from `@stellar/stellar-sdk/base` (keys, StrKey, networks; later XDR and transaction building).
- Horizon access goes through a small client in `packages/shared/src/horizon/client.ts` built on the standard `fetch`, which React Native, Workers and Node all provide. `fetch` is injectable, so tests use recorded real Horizon responses.
- Responses are normalized into Cosignly types (`AccountInfo`, `Vault`). The master key is reported as `masterWeight`, separate from the other signers.

## Consequences

- One code path for app and Worker, no extra HTTP dependency, simple to test.
- New Horizon endpoints (e.g. account history in W1.5) are added to this client by hand. If the list grows a lot, revisit using `Horizon.Server`.
