// Polyfills must load before any Stellar code. @stellar/stellar-sdk 17 needs only
// crypto.getRandomValues (no Buffer); see CLAUDE.md §5.
import "react-native-get-random-values";
import "expo-router/entry";
