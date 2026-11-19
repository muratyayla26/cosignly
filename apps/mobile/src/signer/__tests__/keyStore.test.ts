import { generateSignerKeypair } from "@cosignly/shared";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  deleteSignerKey,
  loadSignerPublicKey,
  saveSignerKey,
  SignerKeyError,
  unlockSignerKey,
} from "../keyStore";

// In-memory SecureStore. Items are keyed by service + key, like the real store.
type MockOptions = { keychainService?: string; requireAuthentication?: boolean };
const mockItems = new Map<string, string>();
const mockId = (key: string, o?: MockOptions) => `${o?.keychainService ?? ""}/${key}`;
let mockBiometrics = true;
let mockNextAuth: "ok" | "cancel" | "invalidated" = "ok";

jest.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 2,
  canUseBiometricAuthentication: jest.fn(() => mockBiometrics),
  setItemAsync: jest.fn(async (k: string, v: string, o?: MockOptions) => {
    mockItems.set(mockId(k, o), v);
  }),
  getItemAsync: jest.fn(async (k: string, o?: MockOptions) => {
    if (o?.requireAuthentication) {
      if (mockNextAuth === "cancel") throw new Error("User canceled the operation.");
      if (mockNextAuth === "invalidated") return null;
    }
    return mockItems.get(mockId(k, o)) ?? null;
  }),
  deleteItemAsync: jest.fn(async (k: string, o?: MockOptions) => {
    mockItems.delete(mockId(k, o));
  }),
}));

const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
  jest.spyOn(console, m).mockImplementation(() => undefined),
);

beforeEach(() => {
  mockItems.clear();
  mockBiometrics = true;
  mockNextAuth = "ok";
  jest.clearAllMocks();
});

it("saves a key behind biometrics and keeps only the public key readable without a prompt", async () => {
  const keypair = generateSignerKeypair();
  await saveSignerKey(keypair, "Protect");

  expect(await loadSignerPublicKey()).toBe(keypair.publicKey());
  const secretWrite = jest
    .mocked(SecureStore.setItemAsync)
    .mock.calls.find(([, value]) => value === keypair.secret());
  expect(secretWrite?.[2]).toMatchObject({
    requireAuthentication: true,
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  });
  // The public key item is not the secret.
  expect(mockItems.get("/cosignly.signer.publicKey")).toBe(keypair.publicKey());
});

it("on iOS, reads the key back once with a prompt right after saving", async () => {
  Platform.OS = "ios";
  await saveSignerKey(generateSignerKeypair(), "Protect");
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
    "cosignly.signer.secretKey",
    expect.objectContaining({ requireAuthentication: true }),
  );
});

it("on Android, does not read back (writing already showed the prompt)", async () => {
  Platform.OS = "android";
  await saveSignerKey(generateSignerKeypair(), "Protect");
  expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  Platform.OS = "ios";
});

it("unlocks the key only through the biometric read and lends a matching keypair", async () => {
  const keypair = generateSignerKeypair();
  await saveSignerKey(keypair, "Protect");
  jest.clearAllMocks();

  const publicKey = await unlockSignerKey("Unlock", (kp) => kp.publicKey());
  expect(publicKey).toBe(keypair.publicKey());
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
    "cosignly.signer.secretKey",
    expect.objectContaining({ requireAuthentication: true, authenticationPrompt: "Unlock" }),
  );
});

it("reports a cancelled prompt as 'cancelled'", async () => {
  await saveSignerKey(generateSignerKeypair(), "Protect");
  mockNextAuth = "cancel";
  await expect(unlockSignerKey("Unlock", () => 1)).rejects.toMatchObject({ kind: "cancelled" });
});

it("reports a key invalidated by the system as 'invalidated'", async () => {
  await saveSignerKey(generateSignerKeypair(), "Protect");
  mockNextAuth = "invalidated";
  await expect(unlockSignerKey("Unlock", () => 1)).rejects.toMatchObject({ kind: "invalidated" });
});

it("refuses to save without biometrics", async () => {
  mockBiometrics = false;
  await expect(saveSignerKey(generateSignerKeypair(), "Protect")).rejects.toMatchObject({
    kind: "biometrics-unavailable",
  });
  expect(mockItems.size).toBe(0);
});

it("leaves nothing behind when the prompt is cancelled while saving (iOS)", async () => {
  Platform.OS = "ios";
  mockNextAuth = "cancel";
  await expect(saveSignerKey(generateSignerKeypair(), "Protect")).rejects.toBeInstanceOf(
    SignerKeyError,
  );
  expect(mockItems.size).toBe(0);
  expect(await loadSignerPublicKey()).toBeNull();
});

it("replaces an existing key and can delete it", async () => {
  await saveSignerKey(generateSignerKeypair(), "Protect");
  const second = generateSignerKeypair();
  await saveSignerKey(second, "Protect");
  expect(await loadSignerPublicKey()).toBe(second.publicKey());

  await deleteSignerKey();
  expect(mockItems.size).toBe(0);
  await expect(unlockSignerKey("Unlock", () => 1)).rejects.toMatchObject({ kind: "invalidated" });
});

it("never logs the secret key and never puts it in an error", async () => {
  const keypair = generateSignerKeypair();
  await saveSignerKey(keypair, "Protect");
  mockNextAuth = "cancel";
  const error = await unlockSignerKey("Unlock", () => 1).catch((e: unknown) => e);
  expect(String(error)).not.toContain(keypair.secret());
  for (const spy of consoleSpies) {
    for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(keypair.secret());
  }
});
