import { describe, expect, it } from "vitest";

import { formatAmount, truncateAddress } from "./format";

describe("truncateAddress", () => {
  it("keeps the first and last four characters", () => {
    expect(truncateAddress("GDDTBEBLVLD32OEMRUEXH7KEHYK5VRVN6ZXAJF7NIWMUG3ATUGTCNLOL")).toBe(
      "GDDT…NLOL",
    );
  });

  it("supports custom lengths", () => {
    expect(truncateAddress("GDDTBEBLVLD32OEMRUEXH7KEHYK5VRVN6ZXAJF7NIWMUG3ATUGTCNLOL", 6, 6)).toBe(
      "GDDTBE…TCNLOL",
    );
  });

  it("leaves short strings alone", () => {
    expect(truncateAddress("GABCDEFGH")).toBe("GABCDEFGH");
    expect(truncateAddress("")).toBe("");
  });
});

describe("formatAmount", () => {
  it.each([
    ["500.0000000", "500"],
    ["1234.5000000", "1,234.5"],
    ["9999.9999500", "9,999.99995"],
    ["0.0000001", "0.0000001"],
    ["0.0000000", "0"],
    ["60158229999.6286695", "60,158,229,999.6286695"],
    ["922337203685.4775807", "922,337,203,685.4775807"],
    ["-12.50", "-12.5"],
    ["-0.0000000", "0"],
    ["007", "7"],
    ["42", "42"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatAmount(input)).toBe(expected);
  });

  it("cuts extra decimals without rounding up", () => {
    expect(formatAmount("1.9999999", { maxDecimals: 2 })).toBe("1.99");
  });

  it("pads to a minimum number of decimals", () => {
    expect(formatAmount("500", { minDecimals: 2 })).toBe("500.00");
    expect(formatAmount("1.5", { minDecimals: 2 })).toBe("1.50");
  });

  it("returns non-numeric input unchanged", () => {
    expect(formatAmount("abc")).toBe("abc");
    expect(formatAmount("1e5")).toBe("1e5");
  });
});
