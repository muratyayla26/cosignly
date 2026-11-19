/**
 * Middle-truncates a Stellar address for display: `GABC…WXYZ`.
 * Short strings are returned unchanged.
 */
export function truncateAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

export interface FormatAmountOptions {
  /** Digits kept after the decimal point (extra digits are cut, never rounded up). Default 7. */
  maxDecimals?: number;
  /** Digits always shown after the decimal point. Default 0. */
  minDecimals?: number;
}

/**
 * Formats a Stellar amount string ("1234.5000000") for display ("1,234.5").
 * Works on the string directly, so large balances never lose precision.
 * Returns the input unchanged if it is not a plain decimal number.
 */
export function formatAmount(amount: string, options: FormatAmountOptions = {}): string {
  const { maxDecimals = 7, minDecimals = 0 } = options;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) return amount;
  const [, sign = "", rawInt = "0", rawFrac = ""] = match;

  const int = rawInt.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let frac = rawFrac.slice(0, maxDecimals).replace(/0+$/, "");
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, "0");

  const isZero = /^0*$/.test(rawInt) && /^0*$/.test(frac);
  return `${isZero ? "" : sign}${int}${frac ? `.${frac}` : ""}`;
}
