import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { Camera, Settings } from "lucide-react-native";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Banner, Button, Text } from "@/components";
import { radius, screenPadding, space, useTheme } from "@/theme";
import { checkNewSigner } from "@/vaultSetup/state";
import { useVaultSetup } from "@/vaultSetup/VaultSetupProvider";

/** Scans a signer's address from a QR code (e.g. Cosignly Settings on their phone). */
export default function ScanSignerScreen() {
  const { colors } = useTheme();
  const { state, dispatch } = useVaultSetup();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  // The camera reports the same code many times per second; handle one at a time.
  const busy = useRef(false);

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (busy.current) return;
    busy.current = true;
    const result = checkNewSigner(data, state.signers);
    if (result.ok) {
      dispatch({ type: "addSigner", key: result.address });
      router.back();
      return;
    }
    setError(result.message);
    setTimeout(() => {
      busy.current = false;
    }, 1500);
  };

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.content}>
        <Text variant="heading">Camera access</Text>
        <Text variant="body" color="textMuted">
          Cosignly uses the camera only to read a signer's address from a QR code. Nothing is
          recorded or sent.
        </Text>
        {permission.canAskAgain ? (
          <Button
            label="Allow camera"
            icon={Camera}
            fullWidth
            onPress={() => void requestPermission()}
          />
        ) : (
          <Button
            label="Open Settings"
            icon={Settings}
            variant="secondary"
            fullWidth
            onPress={() => void Linking.openSettings()}
          />
        )}
        <Button label="Cancel" variant="ghost" fullWidth onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.content}>
      <View style={[styles.frame, { borderColor: colors.borderStrong }]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onScanned}
        />
      </View>
      <Text variant="callout" color="textMuted" align="center">
        Point the camera at the signer's address QR code.
      </Text>
      {error ? <Banner tone="warning" title="Can't add this signer" message={error} /> : null}
      <Button label="Cancel" variant="ghost" fullWidth onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: screenPadding, gap: space.md },
  frame: {
    aspectRatio: 1,
    width: "100%",
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
});
