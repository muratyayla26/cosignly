import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";

import { initialSetupState, setupReducer, type SetupAction, type SetupState } from "./state";

interface VaultSetupContextValue {
  state: SetupState;
  dispatch: Dispatch<SetupAction>;
}

const VaultSetupContext = createContext<VaultSetupContextValue | null>(null);

/**
 * Holds the wizard's answers while the user moves between steps. Lives only in
 * memory and is dropped when the wizard closes; nothing here is secret.
 */
export function VaultSetupProvider({
  ownKey,
  initialActions = [],
  children,
}: {
  ownKey: string;
  /** Applied to the fresh state once (used by tests to start at a later step). */
  initialActions?: readonly SetupAction[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(setupReducer, ownKey, (key) =>
    initialActions.reduce(setupReducer, initialSetupState(key)),
  );
  return <VaultSetupContext value={{ state, dispatch }}>{children}</VaultSetupContext>;
}

export function useVaultSetup(): VaultSetupContextValue {
  const value = useContext(VaultSetupContext);
  if (!value) throw new Error("useVaultSetup must be used inside VaultSetupProvider");
  return value;
}
