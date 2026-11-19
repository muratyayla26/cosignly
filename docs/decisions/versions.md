# Pinned versions

Critical tool and package versions. Update this file in the same PR that changes a version.

| Tool / package | Version | Where | Notes |
|---|---|---|---|
| Node.js | 24 (LTS) | `.nvmrc`, CI | |
| pnpm | 12.15.0 | `package.json` `packageManager` | `pnpm ci` is a built-in pnpm command — the repo script is `pnpm check` |
| TypeScript | ~6.0.3 | root, `apps/mobile` | TypeScript 7 is not yet supported by `typescript-eslint` 8.x (peer `<6.1.0`); Expo SDK 58 templates use `~6.0.3` |
| ESLint | ^10.15.0 | root | Flat config (`eslint.config.mjs`) |
| typescript-eslint | ^8.73.0 | root | |
| Prettier | ^3.10.1 | root | Markdown is excluded (hand-written docs) |
| Vitest | 5.1.0 (exact) | `packages/shared` | Coverage via `@vitest/coverage-v8`; vault rules ≥ 90% enforced. 5.1.1 was < 24 h old and blocked by pnpm's `minimumReleaseAge` |
| @stellar/stellar-sdk | 17.4.0 (exact) | `packages/shared` | Use the `@stellar/stellar-sdk/base` entry. `@stellar/stellar-base` is deprecated (merged into the SDK) |
| GitHub Actions | checkout v7, setup-node v7, pnpm/action-setup v6 | `.github/workflows/ci.yml` | |
| Expo SDK | 58 (`expo ~58.0.26`) | `apps/mobile` | Add Expo packages with `npx expo install` so versions match the SDK |
| React Native | 0.88.1 | `apps/mobile` | |
| React | 19.3.0 | `apps/mobile` | |
| expo-router | ~58.0.32 | `apps/mobile` | Typed routes on |
| lucide-react-native | ^1.74.0 | `apps/mobile` | ESM-only; mocked in Jest |
| @testing-library/react-native | ^14.1.0 | `apps/mobile` | v14: `render`, `fireEvent.*`, `unmount` are async — always `await` |
| jest / jest-expo | ~30.5.2 / ~58.0.15 | `apps/mobile` | |
| eslint-plugin-react-hooks | ^7.1.1 | root | |
