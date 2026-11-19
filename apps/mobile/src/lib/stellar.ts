import { createHorizonClient, getNetworkConfig } from "@cosignly/shared";

/** The network the app runs on (testnet in Sprint 1). */
export const network = getNetworkConfig();

/** Shared Horizon client for the app. */
export const horizon = createHorizonClient({ network });
