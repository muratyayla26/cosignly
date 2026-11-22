# 0003 — Vaults set the low threshold equal to the payment threshold

- **Status:** Accepted
- **Date:** 2026-11-22 (W2.1)

## Context

A Stellar account has three thresholds. Payments and trustlines need **medium**; signer and threshold changes need **high**. A few operations need only **low**, among them `bump_sequence` and `claim_claimable_balance` ([List of operations](https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations), checked 2026-11-22).

Cosignly keeps one pending proposal per vault, tied to the vault's sequence number. If `low` were 1, any single signer could submit a `bump_sequence` and make the pending proposal fail with `tx_bad_seq`. That doesn't move funds, but it lets one person block the others.

## Decision

The setup wizard sets `low = medium`. It never shows a separate "low" setting. Users see two numbers: approvals for payments (medium) and approvals for changing signers (high). The shared helper is `thresholdsFor(payments, admin)` in `packages/shared/src/vault/setup.ts`.

## Consequences

- No single signer can invalidate a pending proposal unless a single signer can already pay alone.
- Claiming a claimable balance sent to the vault needs as many approvals as a payment. That is acceptable and out of scope for Sprint 1.
- Vaults created outside Cosignly may use a lower `low`. The dashboard still shows them; only the wizard applies this rule.
