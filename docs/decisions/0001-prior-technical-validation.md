# 0001 — Prior technical validation

- **Status:** Accepted
- **Date:** before Sprint 1 (Instawards proposal phase)

## Context

Before submitting the Instawards proposal, the riskiest parts of Cosignly were validated with an end-to-end prototype on Stellar testnet, using real devices (iPhone 16, Samsung Galaxy A54). The prototype code is not part of this repository; this record keeps what was learned.

## Results

| Goal | Validated? |
|---|---|
| Set up a shared vault (2-of-3 rule, no single owner) | ✅ Created in a single transaction; the setup key had no authority afterwards |
| Block configurations that would lock the account | ✅ Validation rules caught invalid configurations |
| Find a signer's vaults automatically | ✅ Horizon `GET /accounts?signer=<G...>` |
| Keep the signing key on the phone behind Face ID / fingerprint | ✅ Worked on iPhone 16 and Galaxy A54 |
| Create and sign a proposal on the phone | ✅ Done from both devices |
| Merge signatures from different people and submit automatically at threshold | ✅ Via Refractor; on-chain in ~13 seconds |
| A payment cannot execute twice; an outdated proposal becomes invalid | ✅ Both observed (sequence number behaviour) |
| The backend never holds keys or funds | ✅ No key reached the backend at any step |

## Decision

Build Sprint 1 on classic Stellar multisig with Refractor as the signature aggregator (`RefractorCoordinator`), behind a `SignatureCoordinator` interface so that smart-account vaults (Sprint 2) can use a backend coordinator for Soroban authorization entries.

## Open points to confirm during the sprint

- Exact Refractor callback payload and the full set of `status` values (undocumented).
- Refractor rate limits.
