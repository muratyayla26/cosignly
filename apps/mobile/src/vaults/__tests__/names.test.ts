import AsyncStorage from "@react-native-async-storage/async-storage";

import { loadVaultNames, VAULT_NAMES_STORAGE_KEY, vaultTitle } from "../names";

const VAULT = "GDQMJCBAHXJPIPXGIZH63TYOAFOZW3GO3IVWN6STSAWU2BV7YRTNZQA6";

beforeEach(() => AsyncStorage.clear());

describe("vault names", () => {
  it("uses the local name, or the short address without one", () => {
    expect(vaultTitle(VAULT, { [VAULT]: "Team Vault" })).toBe("Team Vault");
    expect(vaultTitle(VAULT)).toBe("Vault GDQM…ZQA6");
  });

  it("ignores damaged storage", async () => {
    await AsyncStorage.setItem(VAULT_NAMES_STORAGE_KEY, "{not json");
    expect(await loadVaultNames()).toEqual({});
    await AsyncStorage.setItem(VAULT_NAMES_STORAGE_KEY, JSON.stringify({ [VAULT]: 5, x: "Ok" }));
    expect(await loadVaultNames()).toEqual({ x: "Ok" });
  });
});
