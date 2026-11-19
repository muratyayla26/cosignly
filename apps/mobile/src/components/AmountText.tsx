import { formatAmount } from "@cosignly/shared";

import type { ColorToken, TextVariant } from "@/theme";

import { Text } from "./Text";

export interface AmountTextProps {
  /** Stellar amount string, e.g. "500.0000000". */
  amount: string;
  /** Asset code shown after the amount ("XLM", "USDC"). */
  assetCode: string;
  variant?: TextVariant;
  color?: ColorToken;
  maxDecimals?: number;
}

/** Amount with tabular digits and its asset code: "1,234.5 USDC". */
export function AmountText({
  amount,
  assetCode,
  variant = "bodyStrong",
  color = "text",
  maxDecimals,
}: AmountTextProps) {
  const formatted = formatAmount(amount, maxDecimals === undefined ? {} : { maxDecimals });
  return (
    <Text variant={variant} color={color} tabular accessibilityLabel={`${formatted} ${assetCode}`}>
      {formatted} {assetCode}
    </Text>
  );
}
