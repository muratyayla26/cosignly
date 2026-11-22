import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { KeyboardAvoidingView, StyleSheet, View } from "react-native";

/**
 * Shrinks its content by the part of the screen the keyboard covers, so a
 * ScrollView inside can scroll the focused field into view.
 *
 * Uses `padding` on both platforms. Android apps are edge-to-edge (Expo SDK
 * 58 / Android 15+), so the window no longer resizes for the keyboard and the
 * view must make room itself. The keyboard's position is reported in window
 * coordinates, so the offset is this view's own distance from the top of the
 * window (header and status bar), measured rather than guessed.
 */
export function KeyboardAvoidingScreen({ children }: { children: ReactNode }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [offset, setOffset] = useState(0);

  return (
    <View
      ref={ref}
      style={styles.flex}
      onLayout={() => ref.current?.measureInWindow((_x, y) => setOffset(y))}
    >
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={offset}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
