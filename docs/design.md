# Cosignly — Design language

The app's look comes from the logo (concept **B · Quorum**): three signers, two approved (mint) and connected, one pending (indigo ring). The same idea — *approved = mint, pending = indigo outline* — runs through the whole UI.

Principles:
1. **Calm and trustworthy.** This is an app for moving shared money. Plenty of space, few colors, no flashy gradients or decoration.
2. **Plain language first.** Users see "Send 500 USDC to Alex", never XDR, sequence numbers or operation codes. Technical details sit behind a "Details" disclosure.
3. **Status is always obvious.** Every proposal shows who approved, who is pending, and what happens next.
4. **Native feel.** Standard iOS/Android navigation patterns, system haptics, Dynamic Type.

---

## 1. Themes

- Light and dark themes. **Default: follow the system** (`useColorScheme()`).
- Settings → Appearance: **System / Light / Dark**. The choice is stored with AsyncStorage (not secure storage) and applied before the first screen renders, to avoid a flash.
- Status bar, navigation bar (Android) and splash follow the active theme.

## 2. Color tokens

Components use **semantic tokens only** — never raw hex values. All text pairs below meet WCAG AA (≥ 4.5:1); control borders meet 3:1. Contrast was checked when these values were chosen.

### Brand (fixed, for logo and marketing)
| Token | Hex |
|---|---|
| `brand.ink` | `#0B1020` |
| `brand.indigo` | `#5B5CF0` |
| `brand.violet` | `#8B7CFF` |
| `brand.mint` | `#2BD4A4` |
| `brand.mintOnLight` | `#0F9A76` |
| `brand.paper` | `#F5F7FB` |

### Semantic
| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F5F7FB` | `#0B1020` | Screen background |
| `surface` | `#FFFFFF` | `#141A33` | Cards, sheets |
| `surfaceMuted` | `#EEF1F8` | `#1C2342` | Grouped rows, inputs |
| `border` | `#DDE1EE` | `#2A3463` | Dividers, card outlines (decorative) |
| `borderStrong` | `#7A82A8` | `#5D6899` | Input and control borders |
| `text` | `#0B1020` | `#F5F7FB` | Primary text |
| `textMuted` | `#4A5480` | `#A9B1D6` | Secondary text, labels |
| `primary` | `#4B4CE0` | `#8B8CFF` | Primary buttons, links, focus, "pending" ring |
| `onPrimary` | `#FFFFFF` | `#0B1020` | Text on primary |
| `primaryTint` | `#ECECFD` | `#20244F` | Selected states, info banners |
| `success` | `#0B7D60` | `#2BD4A4` | Approved / executed text |
| `successGraphic` | `#0F9A76` | `#2BD4A4` | Approved signer dots, check icons |
| `successTint` | `#E3F6F0` | `#10302B` | Success badges, banners |
| `warning` | `#9A5B00` | `#F5B544` | Stale, expiring soon, risky config |
| `warningTint` | `#FFF3DC` | `#33280F` | Warning badges, banners |
| `danger` | `#C0362C` | `#FF7A70` | Failed, destructive actions, invalid config |
| `dangerTint` | `#FDE8E6` | `#3A1A1F` | Error badges, banners |

Rules:
- Mint is **never** text on a light background (1.9:1) — use `success` there.
- Color never carries meaning alone: every status has an icon and a label.
- In dark mode, separate surfaces with `border`, not shadows.

## 3. Typography

- **Inter** for everything (`@expo-google-fonts/inter`: 400, 500, 600, 700). Full Turkish character support.
- Amounts: `fontVariant: ['tabular-nums']` so digits line up.
- Stellar addresses: system monospace, middle-truncated (`GABC…WXYZ`), with copy action; full address in a sheet on tap.
- Support Dynamic Type / font scaling; never fix a text container's height.

| Style | Size / line height | Weight |
|---|---|---|
| `display` | 32 / 38 | 700 |
| `title` | 24 / 30 | 600 |
| `heading` | 20 / 26 | 600 |
| `body` | 16 / 24 | 400 |
| `bodyStrong` | 16 / 24 | 600 |
| `callout` | 15 / 22 | 500 |
| `caption` | 13 / 18 | 500 |
| `amountLarge` | 40 / 46 | 600, tabular |

## 4. Spacing, radius, elevation

- 4-pt grid: `4, 8, 12, 16, 20, 24, 32, 40, 48`. Screen padding 20.
- Radius: `sm 8` (badges, chips) · `md 12` (buttons, inputs) · `lg 16` (cards) · `xl 24` (bottom sheets).
- Touch targets ≥ 44 × 44.
- Elevation: light theme may use one soft shadow on floating elements; dark theme uses borders only.

## 5. Iconography and motion

- One icon set: **Lucide** (`lucide-react-native`), 1.75 stroke, 20/24 px. No emoji in the UI.
- Motion is short and functional (150–250 ms). Respect "Reduce Motion".
- Approval moment: the signer dot fills mint and a light success haptic plays (`expo-haptics`). Executed: one subtle success state, no confetti.

## 6. Signature components

| Component | Description |
|---|---|
| `QuorumProgress` | The logo idea as UI: one dot per required approval; approved = filled `successGraphic`, pending = `primary` ring. Label: "1 of 2 approvals". Used on cards, review screen and notifications' landing screen. |
| `ProposalCard` | Vault name, plain-language summary ("Send 500 USDC to Alex"), amount, `QuorumProgress`, status badge, expiry. |
| `StatusBadge` | pending · ready · executed · expired · stale · failed — icon + label + tint. |
| `AddressChip` | Truncated address, optional contact name, copy button, stellar.expert link. |
| `AmountText` | Tabular amount with asset code (XLM, USDC). |
| `ThresholdSummary` | "Payments need 2 of 3 · Changing signers needs 2 of 3", with a warning row when the N-1 rule is not met. |
| `ApproveButton` | Full-width primary button, biometric icon, triggers the Face ID / fingerprint prompt. |
| `Banner` | Info / success / warning / danger, using the tint tokens. |

Build these as small in-house primitives on top of `StyleSheet` and the theme hook — no heavy UI kit.

## 7. Implementation

- `apps/mobile/src/theme/`: `tokens.ts` (brand + light + dark), `typography.ts`, `spacing.ts`, `ThemeProvider` (system / light / dark), `useTheme()`.
- Components read colors only through `useTheme()`; a lint rule or review check blocks raw hex values in components.
- Brand assets live in `assets/brand/` (see below) and are wired in `app.json` / `app.config.ts`.

## 8. Brand assets (`assets/brand/`)

| File | Use |
|---|---|
| `icon-1024.png` | iOS app icon (opaque, no rounded corners — iOS masks it) |
| `adaptive-icon-foreground.png` | Android adaptive icon foreground (transparent); background color `#0B1020` |
| `adaptive-icon-monochrome.png` | Android 13+ themed icon |
| `splash-icon-light.png` / `splash-icon-dark.png` | Splash image for light (`#F5F7FB`) and dark (`#0B1020`) backgrounds |
| `google-play-512.png` | Google Play listing icon |
| `x-avatar-400.png` | Social avatar |
| `mark-on-light-512.png` / `mark-on-dark-512.png` | Logo mark alone (in-app "About", favicons, small spaces) |
| `lockup-horizontal-on-light.png` / `-on-dark.png` | Mark + "Cosignly" side by side: README header, docs, X banner, GitHub social preview, store screenshots |
| `lockup-stacked-on-light.png` / `-on-dark.png` | Mark above "Cosignly": square formats, onboarding / welcome screen, slides |
| `wordmark-on-light.png` / `-on-dark.png` | "Cosignly" text only, for places where the mark already appears nearby |
| `svg/` | Source SVGs for all of the above (wordmark text converted to paths, so no font is needed) |

Usage:
- App icons, splash and avatars use the **mark only** — never put text in an app icon.
- Use the `on-light` files on light backgrounds and `on-dark` files on dark backgrounds; in the app, pick by the active theme.
- Keep clear space around a lockup at least the height of the mark's top dot; don't stretch, recolor or add effects.
- Wordmark font: Inter Display SemiBold (SIL Open Font License), tracking −2%.

Name in UI and stores: **Cosignly** (capital C).

## 9. Sample content

Demo data, screenshots, store listings, videos and tests use short, global English names (e.g. Alex, Sam, Jordan, Taylor) and neutral vault names (e.g. "Team Vault", "Grant Treasury").
