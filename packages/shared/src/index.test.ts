import { describe, expect, it } from "vitest";

import { DEEP_LINK_SCHEME, PRODUCT_NAME } from "./index";

describe("@cosignly/shared", () => {
  it("exposes the product identifiers", () => {
    expect(PRODUCT_NAME).toBe("Cosignly");
    expect(DEEP_LINK_SCHEME).toBe("cosignly");
  });
});
