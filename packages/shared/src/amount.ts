/** Stellar amounts have exactly 7 decimal places; 1 XLM = 10,000,000 stroops. */
const DECIMALS = 7;
const SCALE = 10n ** BigInt(DECIMALS);

/** Parses a Stellar amount string ("12.5", "0.0000001") into stroops. Throws on bad input. */
export function toStroops(amount: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,7}))?$/.exec(amount.trim());
  if (!match) throw new TypeError(`Not a Stellar amount: "${amount}"`);
  const [, sign, int = "0", frac = ""] = match;
  const value = BigInt(int) * SCALE + BigInt(frac.padEnd(DECIMALS, "0"));
  return sign === "-" ? -value : value;
}

/** Formats stroops as a Stellar amount string with 7 decimals ("12.5000000"). */
export function fromStroops(stroops: bigint): string {
  const negative = stroops < 0n;
  const abs = negative ? -stroops : stroops;
  const int = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(DECIMALS, "0");
  return `${negative ? "-" : ""}${int}.${frac}`;
}
