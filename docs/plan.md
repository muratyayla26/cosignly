# Cosignly — Sprint 1 Plan (Instawards, 30 days)

This is the execution plan for the approved Instawards Statement of Work (SOW).
Each task below is one GitHub issue, one branch and one pull request. Each week is a GitHub milestone and ends with a tag on `main`.

**Sprint objective (from the SOW):** By day 30, a team can create a 2-of-3 shared Stellar testnet account from the app; any member can propose an XLM or USDC payment; the other members get a push notification, review it in plain language and approve it with Face ID or fingerprint; and the payment is submitted automatically once the threshold is reached, on both iOS and Android.

| SOW deliverable | Covered by |
|---|---|
| 1. Mobile app core: signer keys and vaults | W1.2–W1.5, W2.1–W2.2 |
| 2. Proposal & approval flow | W2.3–W2.5, W3.5 |
| 3. Backend, push notifications & pilot | W3.1–W3.5, W4.2–W4.4 |

---

## Week 1 — Foundations, keys & vaults
**Milestone:** `Week 1` · **Tag:** `week-1`
**Expected output (SOW):** App on iOS and Android with a biometric-protected signer key, automatic listing of the vaults that key signs for, and a dashboard showing live testnet data.

| ID | Task | Done when |
|---|---|---|
| W1.1 | **Repo bootstrap** — pnpm monorepo (`apps/mobile`, `apps/api`, `packages/shared`), TypeScript strict, ESLint/Prettier, Vitest, GitHub Actions CI, `.gitignore` / `.env.example`, README skeleton, `CONTRIBUTING.md` (not accepting contributions), `SECURITY.md`, PR template | CI green on `main`; README explains what Cosignly is |
| W1.2 | **Shared core** — network config (testnet), Horizon helpers (account, signers, thresholds, balances, `?signer=` discovery), vault config validation (lockout rules incl. N-1 rule) with human-readable threshold descriptions, `SignatureCoordinator` interface (types only) | Unit tests cover every lockout rule; coverage ≥ 90% for validation |
| W1.3 | **Mobile app bootstrap + design foundation** — Expo development build, `expo-router`, polyfills for `@stellar/stellar-sdk`, app name **Cosignly**, scheme `cosignly`, EAS config; theme system from `docs/design.md` (tokens, typography, spacing, `ThemeProvider` with System / Light / Dark, Inter font, Lucide icons); app icon, adaptive icon and light/dark splash from `assets/brand/`; base primitives (`Text`, `Button`, `Card`, `Banner`, `StatusBadge`, `AddressChip`, `AmountText`, `QuorumProgress`) | App runs on iPhone and Android, follows the system theme, shows the Cosignly icon and splash, and displays network status |
| W1.4 | **Signer key** — generate or import (`S...`), stored with `expo-secure-store` behind biometrics, onboarding screens, recovery explanation (recovery happens through the other signers), settings with public key + QR and Appearance (System / Light / Dark) | Key survives app restart; biometric prompt required to use it; key never logged; theme choice persists |
| W1.5 | **Vault discovery & dashboard** — list vaults the key signs for, vault detail (balances, signers, weights, thresholds, recent history), pull to refresh, stellar.expert links | A vault created with the CLI appears automatically on both devices |

**Week 1 checkpoint:** demo on both devices; `docs/weekly/week-1.md`; evidence entries; tag `week-1`.
**Murat (manual):** decide bundle id, create EAS project, confirm `gh` auth; create Cloudflare account and Firebase project before Week 3.

---

## Week 2 — Vault setup & proposals
**Milestone:** `Week 2` · **Tag:** `week-2`
**Expected output (SOW):** 2-of-3 vault created from the app on testnet (visible on stellar.expert); proposal visible on Refractor.

| ID | Task | Done when |
|---|---|---|
| W2.1 | **Vault setup wizard (UI)** — name → signers (paste / QR scan, self added automatically) → rules (templates 2/2, 2/3, 3/5 + advanced weights; payment vs. admin thresholds shown separately) → review screen with validation results, N-1 warning and XLM reserve cost | Invalid configurations cannot be submitted; risky ones need explicit confirmation |
| W2.2 | **Vault creation transaction** — ephemeral account (Friendbot on testnet), one transaction: USDC trustline, signers, thresholds, master weight 0; vault name stored locally | New vault visible on stellar.expert with correct signers and thresholds |
| W2.3 | **Transaction decoder** (`packages/shared`) — payment, create_account, change_trust, set_options → plain-language summary; unknown operations flagged in red | Unit tests with real testnet XDR fixtures |
| W2.4 | **Payment proposal** — asset (XLM/USDC), recipient (existence + USDC trustline check), amount, memo, 7-day time bounds → biometric sign → upload via `RefractorCoordinator` | Proposal appears on Refractor with 1 signature |
| W2.5 | **Review & approve screen** — decoded summary, signer progress from Refractor, approve with biometrics, share Refractor link for co-signers using other wallets | Second signature (device or CLI) triggers automatic submission |

**Week 2 checkpoint:** create a 2-of-3 vault in the app, propose, approve from the second device → executed. `docs/weekly/week-2.md`; tag `week-2`.
**Murat (manual):** Firebase project + FCM V1 key and Apple APNs key ready for Week 3.

---

## Week 3 — Backend, notifications & approvals
**Milestone:** `Week 3` · **Tag:** `week-3`
**Expected output (SOW):** Full flow across devices: propose → push → approve → automatic submission; testnet transaction hashes.

| ID | Task | Done when |
|---|---|---|
| W3.1 | **API foundation** — Worker + D1 migrations, `GET /health`, signed-challenge auth (Ed25519), basic rate limiting, tests | Deployed to workers.dev; health URL public |
| W3.2 | **Devices & proposals API** — push token registration, `POST /proposals` (validated against Horizon: source is a vault, proposer is a signer), `GET /vaults/:id/proposals` | Proposals from the app are indexed per vault |
| W3.3 | **Sync & push** — Refractor callback endpoint, cron sync (status changes, expiry, stale), Expo Push sending + receipts + invalid-token cleanup | "Approval needed" and "Executed" pushes are sent; visible in `wrangler tail` |
| W3.4 | **Mobile notifications** — auth + token registration on launch, push permission UX, deep link `cosignly://proposal/<hash>` to the review screen, proposals inbox | Tapping a push opens the right proposal on both platforms |
| W3.5 | **Proposal lifecycle** — `pending → submitted → executed`, `failed`, `expired`, `stale` (sequence conflict) → "recreate" flow; one pending proposal per vault enforced in UI and API | Stale and expired proposals are handled without user confusion |

**Week 3 checkpoint:** propose on iPhone → push on Android → approve → executed → both devices notified. `docs/weekly/week-3.md`; tag `week-3`.

---

## Week 4 — Hardening, pilot & release
**Milestone:** `Week 4` · **Tag:** `v0.1.0`
**Expected output (SOW):** Pilot feedback summary; installable builds; user guide; demo video; sprint report delivered to the Chapter Lead.

| ID | Task | Done when |
|---|---|---|
| W4.1 | **Polish** — onboarding, empty and error states (network, Horizon, Refractor, biometric cancel), history screen, accessibility pass (Dynamic Type, screen reader labels, contrast in both themes) | No dead ends in the main flows; every screen checked in light and dark |
| W4.2 | **Builds** — EAS builds: TestFlight (internal testing first; external testing needs Beta App Review, plan ~1 day) and Android APK via EAS internal distribution | Install links work for pilot users |
| W4.3 | **Pilot** — one-page pilot guide (TR), feedback form, collect feedback, fix the top issues | `docs/feedback.md` with pilot feedback and fixes |
| W4.4 | **Docs** — final README (what, why, architecture diagram, setup), `docs/user-guide.en.md` + `docs/user-guide.tr.md`, `docs/architecture.md` (data flow, security model), demo video scripts (≤2 min setup, ≤3 min propose → approve) | Docs reviewed; videos recorded |
| W4.5 | **Sprint report** — `docs/sprint-report.md` (planned vs. shipped per SOW deliverable, open items, Sprint 2 proposal), evidence checklist complete | Every SOW evidence item has a working link |

**Week 4 checkpoint:** SOW evidence checklist complete; tag `v0.1.0`; report sent to the Chapter Lead.

---

## Out of scope for Sprint 1
See the SOW and `CLAUDE.md` §4. Ideas that come up during the sprint go to `docs/backlog.md`.
Sprint 2 (planned): smart-account vaults via Smart Account Kit. Sprint 3 (planned): policies, passkeys, mainnet, store release.
