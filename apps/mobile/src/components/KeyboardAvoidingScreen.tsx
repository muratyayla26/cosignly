import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
import { Keyboard, Platform, StyleSheet, View, type KeyboardEvent } from "react-native";

const KeyboardOpenContext = createContext(false);

/** `true` while the keyboard covers part of the enclosing `KeyboardAvoidingScreen`. */
export function useKeyboardOpen(): boolean {
  return useContext(KeyboardOpenContext);
}

/**
 * Adds bottom padding equal to the part of this view the keyboard covers, so
 * a ScrollView inside can scroll the focused field into view and a footer
 * sits right on top of the keyboard.
 *
 * Why not React Native's `KeyboardAvoidingView`:
 * - Android apps are edge-to-edge (Expo SDK 58 / Android 15+), so the window
 *   no longer resizes for the keyboard; the view must make room itself.
 * - It computes the overlap once per keyboard event from a fixed offset. With
 *   `autoFocus` the keyboard opens during the screen transition, before the
 *   view is measured, and the result is never corrected.
 * Here the view's position is measured whenever the keyboard or the layout
 * changes, and the overlap is recomputed from the last keyboard position.
 *
 * Children that add their own bottom safe-area inset should drop it while
 * `useKeyboardOpen()` is true: the keyboard already covers that area.
 */
export function KeyboardAvoidingScreen({ children }: { children: ReactNode }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  // Top edge of the keyboard in window coordinates, or null when it's hidden.
  const keyboardTop = useRef<number | null>(null);
  const [overlap, setOverlap] = useState(0);

  // No animation: the footer jumps straight to its place (the same on both platforms).
  const update = useCallback(() => {
    const top = keyboardTop.current;
    if (top === null) {
      setOverlap(0);
      return;
    }
    ref.current?.measureInWindow((_x, y, _width, height) => {
      if (height === 0) return; // not laid out yet; onLayout will call again
      setOverlap(Math.max(0, Math.round(y + height - top)));
    });
  }, []);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      keyboardTop.current = e.endCoordinates.screenY;
      update();
    };
    const onHide = () => {
      keyboardTop.current = null;
      update();
    };
    // Move up once the keyboard is in place ("did"), so the footer never floats
    // over empty space while the keyboard slides in. On iOS move down as soon as
    // it starts hiding ("will"), so the footer never sits behind it.
    const subscriptions = [
      Keyboard.addListener("keyboardDidShow", onShow),
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardWillHide", onHide)
        : Keyboard.addListener("keyboardDidHide", onHide),
    ];
    // The keyboard may already be open when this screen mounts.
    const metrics = Keyboard.metrics();
    if (Keyboard.isVisible() && metrics) {
      keyboardTop.current = metrics.screenY;
      update();
    }
    return () => subscriptions.forEach((s) => s.remove());
  }, [update]);

  return (
    <View ref={ref} style={styles.flex} onLayout={() => update()}>
      <KeyboardOpenContext value={overlap > 0}>
        <View style={[styles.flex, { paddingBottom: overlap }]}>{children}</View>
      </KeyboardOpenContext>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
