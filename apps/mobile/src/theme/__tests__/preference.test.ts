import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  APPEARANCE_STORAGE_KEY,
  loadAppearancePreference,
  resolveColorScheme,
  saveAppearancePreference,
} from "../preference";

beforeEach(() => AsyncStorage.clear());

describe("resolveColorScheme", () => {
  it.each([
    ["system", "dark", "dark"],
    ["system", "light", "light"],
    ["system", null, "light"],
    ["light", "dark", "light"],
    ["dark", "light", "dark"],
  ] as const)("preference %s + system %s → %s", (pref, system, expected) => {
    expect(resolveColorScheme(pref, system)).toBe(expected);
  });
});

describe("appearance preference storage", () => {
  it("defaults to system", async () => {
    expect(await loadAppearancePreference()).toBe("system");
  });

  it("round-trips a saved choice", async () => {
    await saveAppearancePreference("dark");
    expect(await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe("dark");
    expect(await loadAppearancePreference()).toBe("dark");
  });

  it("ignores unknown stored values", async () => {
    await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, "purple");
    expect(await loadAppearancePreference()).toBe("system");
  });

  it("falls back to system when storage fails", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk"));
    expect(await loadAppearancePreference()).toBe("system");
  });

  it("does not throw when saving fails", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk"));
    await expect(saveAppearancePreference("light")).resolves.toBeUndefined();
  });
});
