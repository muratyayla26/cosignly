import { generateSignerKeypair, type Keypair } from "@cosignly/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { deleteSignerKey, loadSignerPublicKey, saveSignerKey, unlockSignerKey } from "./keyStore";

export type SignerState =
  { status: "loading" } | { status: "none" } | { status: "ready"; publicKey: string };

export interface Signer {
  state: SignerState;
  /** Creates a new key on this device. Shows the biometric prompt. Returns the public key. */
  createKey: () => Promise<string>;
  /** Stores an existing keypair (already parsed). Shows the biometric prompt. */
  importKey: (keypair: Keypair) => Promise<string>;
  /** Asks for biometrics, then lends the keypair to `withKey`. Do not keep it. */
  unlock: <T>(prompt: string, withKey: (keypair: Keypair) => T | Promise<T>) => Promise<T>;
  removeKey: () => Promise<void>;
}

export const SAVE_PROMPT = "Protect your Cosignly signer key";

const SignerContext = createContext<Signer | null>(null);

export function SignerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SignerState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void loadSignerPublicKey()
      .catch(() => null)
      .then((publicKey) => {
        if (cancelled) return;
        setState(publicKey ? { status: "ready", publicKey } : { status: "none" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const importKey = useCallback(async (keypair: Keypair) => {
    await saveSignerKey(keypair, SAVE_PROMPT);
    const publicKey = keypair.publicKey();
    setState({ status: "ready", publicKey });
    return publicKey;
  }, []);

  const createKey = useCallback(() => importKey(generateSignerKeypair()), [importKey]);

  const removeKey = useCallback(async () => {
    await deleteSignerKey();
    setState({ status: "none" });
  }, []);

  const value = useMemo<Signer>(
    () => ({ state, createKey, importKey, unlock: unlockSignerKey, removeKey }),
    [state, createKey, importKey, removeKey],
  );

  return <SignerContext.Provider value={value}>{children}</SignerContext.Provider>;
}

export function useSigner(): Signer {
  const signer = useContext(SignerContext);
  if (!signer) throw new Error("useSigner must be used inside <SignerProvider>.");
  return signer;
}

/** The public key of a signer that is known to exist (screens behind onboarding). */
export function useSignerPublicKey(): string {
  const { state } = useSigner();
  if (state.status !== "ready") throw new Error("No signer key on this device.");
  return state.publicKey;
}
