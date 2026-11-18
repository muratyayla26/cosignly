# apps/api

The Cosignly API: a Cloudflare Worker with D1 and a Cron Trigger. Scaffolded in task W3.1 — see [`docs/plan.md`](../../docs/plan.md).

The API stores metadata only (signers' public keys, push tokens, proposal index). It never receives or stores secret keys or funds.
