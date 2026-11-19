# apps/mobile

The Cosignly iOS and Android app: Expo SDK 58, Expo Router, development build (not Expo Go).

## Structure

| Path | What |
|---|---|
| `index.ts` | Entry: loads the `crypto.getRandomValues` polyfill, then Expo Router |
| `src/app/` | Screens (Expo Router file-based routes) |
| `src/theme/` | Design tokens, typography, spacing, `ThemeProvider` / `useTheme()` — see `docs/design.md` |
| `src/components/` | Base components (`Text`, `Button`, `Card`, `Banner`, `StatusBadge`, `AddressChip`, `AmountText`, `QuorumProgress`, …) |
| `src/lib/` | App helpers (Horizon client instance, hooks) |

Rules: components take colors only from `useTheme()` (ESLint blocks raw hex values outside `src/theme/tokens.ts`); Stellar logic lives in `@cosignly/shared`.

## Run on a device (local development build)

Prerequisites: Xcode + CocoaPods, Android Studio + JDK 17, a phone connected with USB.

```bash
pnpm install                       # repo root
cd apps/mobile

# iPhone (Developer Mode on; Xcode signed in to team LB743V5W75)
pnpm ios --device                  # = expo run:ios --device, pick the iPhone

# Android (USB debugging on; check with `adb devices`)
pnpm android --device              # = expo run:android --device
```

The first build takes several minutes. Afterwards, `pnpm start` runs Metro and the installed Cosignly dev app reconnects; rebuild only when native dependencies or `app.json` change.

**When you rebuild after a native or `app.json` change, regenerate the native projects first.** `expo run` does not re-apply `app.json` to existing `ios/` / `android/` folders:

```bash
npx expo prebuild --clean          # then pnpm ios --device / pnpm android --device
```

`ios/` and `android/` are generated (Continuous Native Generation) and gitignored — change native settings through `app.json` and config plugins, never by hand.

## Tests

```bash
pnpm test        # Jest (jest-expo) + React Native Testing Library
pnpm typecheck
```
