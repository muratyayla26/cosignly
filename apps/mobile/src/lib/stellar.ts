import {
  createHorizonClient,
  createRefractorCoordinator,
  getNetworkConfig,
  getUsdc,
  type SignatureCoordinator,
} from "@cosignly/shared";

/** The network the app runs on (testnet in Sprint 1). */
export const network = getNetworkConfig();

/** Shared Horizon client for the app. */
export const horizon = createHorizonClient({ network });

/** The USDC the app trusts on this network. */
export const usdc = getUsdc(network.id);

/** Collects signatures for proposals (Refractor in Sprint 1). Use only the interface. */
export const coordinator: SignatureCoordinator = createRefractorCoordinator();
