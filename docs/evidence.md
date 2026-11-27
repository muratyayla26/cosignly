# Evidence

Proof for each Instawards SOW deliverable. Every row should be verifiable by clicking the link — no local setup needed.

The kind of evidence depends on the week's work: pull requests, transaction and account links, Refractor links, screenshots, and a screen recording only when a week's work calls for one. Weekly reports sent to the Chapter Lead link the repo, pull requests, screenshots and on-chain transactions.

| Date | Task | What it proves | Link |
|---|---|---|---|
| 2026-11-18 | W1.1 | Monorepo, CI and repo docs in place | [PR #6](https://github.com/muratyayla26/cosignly/pull/6) |
| 2026-11-18 | W1.2 | Lockout rules and Horizon helpers, tested against real testnet data | [PR #7](https://github.com/muratyayla26/cosignly/pull/7) |
| 2026-11-18 | W1.2 | 2-of-3 test vault (Alex, Sam, Jordan; master key off) created with the Stellar CLI | [stellar.expert](https://stellar.expert/explorer/testnet/account/GDDTBEBLVLD32OEMRUEXH7KEHYK5VRVN6ZXAJF7NIWMUG3ATUGTCNLOL) |
| 2026-11-19 | W1.3 | App runs on iPhone and Android with light/dark themes and network status | [PR #8](https://github.com/muratyayla26/cosignly/pull/8) |
| 2026-11-19 | W1.4 | Signer key created/imported on the phone behind Face ID / fingerprint | [PR #9](https://github.com/muratyayla26/cosignly/pull/9) |
| 2026-11-19 | W1.5 | Both phones find the test vault by signer; dashboard matches Horizon | [PR #10](https://github.com/muratyayla26/cosignly/pull/10) |
| 2026-11-19 | W1.5 | Incoming payment shown in vault activity ("Received 25 XLM") | [stellar.expert tx](https://stellar.expert/explorer/testnet/tx/b42d973f262bf08e85b72e96076a0b268b0a86ef59958f6daa029a02455984b7) |
| 2026-11-19 | W1.5 | 2-of-2 vault created from the CLI appeared on the iPhone automatically (with the N-1 warning) | [stellar.expert](https://stellar.expert/explorer/testnet/account/GBS7QGG5CJ4JM46LZFW2Z6PLVBGN53OIN3TPVWBOT5HBWTJANI2QHDTP) |
| 2026-11-19 | Week 1 | Week 1 tag on `main`, CI green | [week-1](https://github.com/muratyayla26/cosignly/releases/tag/week-1) · [CI](https://github.com/muratyayla26/cosignly/actions/runs/44530257920) |
| 2026-11-22 | W2.1 | Vault setup wizard on both phones: invalid setups can't be submitted, the N-1 risk needs an explicit tick, the XLM reserve is shown | [PR #18](https://github.com/muratyayla26/cosignly/pull/18) |
| 2026-11-22 | W2.2 | 2-of-3 vault created from the iPhone app in one transaction (USDC trustline, 3 signers, thresholds, master key off) | [stellar.expert vault](https://stellar.expert/explorer/testnet/account/GCTABDKBN34FA5WTRB5IMUUW3YNQHFT6KXESTA2PPQJRU5WIC2V2ESZ2) · [setup tx](https://stellar.expert/explorer/testnet/tx/53f5fdc80d753b33a50be0959a6450e0d375dab21268c9eac36a7ac4415aa1b2) · [PR #19](https://github.com/muratyayla26/cosignly/pull/19) |
| 2026-11-22 | W2.3 | Plain-language transaction decoder tested on real testnet transactions; an operation it can't read is flagged in red (example: payment + `manage_data`) | [PR #20](https://github.com/muratyayla26/cosignly/pull/20) · [flagged tx](https://stellar.expert/explorer/testnet/tx/787512a0c7b8ed930e5d95c96ea669587d6b432379bfa933884f62099bf7dcdc) |
| 2026-11-24 | W2.4 | Automated end-to-end run: proposal uploaded to Refractor with 1 signature, second signature added, Refractor submitted it | [Refractor](https://refractor.space/tx/a8d2412cda1bcdf00bd64c8f4fc3040e3b77a40e3bb9252f5ff21bac67f21449) · [stellar.expert tx](https://stellar.expert/explorer/testnet/tx/a8d2412cda1bcdf00bd64c8f4fc3040e3b77a40e3bb9252f5ff21bac67f21449) · [PR #21](https://github.com/muratyayla26/cosignly/pull/21) |
| 2026-11-27 | W2.4–W2.5 | Week 2 checkpoint: 25 XLM proposed on the iPhone from Team Vault (2-of-3), approved on the Android phone with a fingerprint, submitted automatically at 2 of 3 approvals | [stellar.expert tx](https://stellar.expert/explorer/testnet/tx/42ec796b958e17070b984dc42a08666c921deab179e31651ffc052709232765f) · [Refractor](https://refractor.space/tx/42ec796b958e17070b984dc42a08666c921deab179e31651ffc052709232765f) · [PR #22](https://github.com/muratyayla26/cosignly/pull/22) |
