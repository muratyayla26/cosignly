// Official in-memory mock for AsyncStorage.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Lucide ships ESM-only (.mjs); icons carry no logic worth testing, so render nothing.
jest.mock(
  "lucide-react-native",
  () => new Proxy({}, { get: (_target, name) => (name === "__esModule" ? true : () => null) }),
);
