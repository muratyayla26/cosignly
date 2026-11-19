import { describe, expect, it } from "vitest";

import { fromStroops, toStroops } from "./amount";

describe("toStroops / fromStroops", () => {
  it.each([
    ["0", 0n],
    ["1", 10_000_000n],
    ["0.0000001", 1n],
    ["12.5", 125_000_000n],
    ["10000.0000000", 100_000_000_000n],
    ["-2.5", -25_000_000n],
  ])("%s ↔ %d stroops", (amount, stroops) => {
    expect(toStroops(amount)).toBe(stroops);
  });

  it("formats with 7 decimals", () => {
    expect(fromStroops(125_000_000n)).toBe("12.5000000");
    expect(fromStroops(1n)).toBe("0.0000001");
    expect(fromStroops(-25_000_000n)).toBe("-2.5000000");
  });

  it("keeps precision beyond floating point", () => {
    expect(fromStroops(toStroops("922337203685.4775807"))).toBe("922337203685.4775807");
  });

  it.each(["", "abc", "1.00000001", "1e5"])("rejects %j", (bad) => {
    expect(() => toStroops(bad)).toThrow(TypeError);
  });
});
