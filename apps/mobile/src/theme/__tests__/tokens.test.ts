import { dark, light, type ColorToken, type ColorTokens } from "../tokens";

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// Text/background pairs the components actually render (docs/design.md §2: ≥ 4.5:1).
const TEXT_PAIRS: [ColorToken, ColorToken][] = [
  ...(["text", "textMuted", "primary", "success", "warning", "danger"] as const).flatMap((fg) =>
    (["bg", "surface", "surfaceMuted"] as const).map((bg): [ColorToken, ColorToken] => [fg, bg]),
  ),
  ["onPrimary", "primary"],
  ["primary", "primaryTint"],
  ["success", "successTint"],
  ["warning", "warningTint"],
  ["danger", "dangerTint"],
  ["text", "primaryTint"],
  ["text", "successTint"],
  ["text", "warningTint"],
  ["text", "dangerTint"],
];

// Control borders and status graphics (≥ 3:1).
const GRAPHIC_PAIRS: [ColorToken, ColorToken][] = [
  ["borderStrong", "surface"],
  ["borderStrong", "bg"],
  ["successGraphic", "surface"],
  ["successGraphic", "bg"],
  ["primary", "surface"],
  ["primary", "bg"],
];

describe.each([
  ["light", light],
  ["dark", dark],
] as [string, ColorTokens][])("%s theme", (_name, tokens) => {
  it.each(TEXT_PAIRS)("%s on %s meets 4.5:1", (fg, bg) => {
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GRAPHIC_PAIRS)("%s on %s meets 3:1", (fg, bg) => {
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(3);
  });

  it("defines every token as a 6-digit hex color", () => {
    for (const value of Object.values(tokens)) expect(value).toMatch(/^#[0-9A-F]{6}$/);
  });
});

it("light and dark define the same tokens", () => {
  expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
});
