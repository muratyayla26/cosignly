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

interface KeyboardState {
  /** Height of this screen the keyboard covers (0 when hidden). */
  overlap: number;
  /** `true` when the screen itself makes room (footer sits on the keyboard). */
  avoiding: boolean;
}

const KeyboardContext = createContext<KeyboardState>({ overlap: 0, avoiding: false });

/** `true` while the screen is lifted above the keyboard (footers drop their bottom inset). */
export function useKeyboardOpen(): boolean {
  const { overlap, avoiding } = useContext(KeyboardContext);
  return avoiding && overlap > 0;
}

/** Height of the enclosing `KeyboardAvoidingScreen` the keyboard covers, in points. */
export function useKeyboardOverlap(): number {
  return useContext(KeyboardContext).overlap;
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
export function KeyboardAvoidingScreen({
  children,
  avoid = true,
}: {
  children: ReactNode;
  /**
   * `true`: add bottom padding so everything (including a footer) moves above
   * the keyboard. `false`: only measure; children use `useKeyboardOverlap()`,
   * e.g. to shrink just a ScrollView while a footer stays behind the keyboard.
   */
  avoid?: boolean;
}) {
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
    // iOS sends "will" events as the keyboard starts moving, so the layout jumps
    // to its final place at once ("did" arrives only after the slide, which
    // feels late). Android only has "did" events.
    const subscriptions =
      Platform.OS === "ios"
        ? [
            Keyboard.addListener("keyboardWillShow", onShow),
            Keyboard.addListener("keyboardWillChangeFrame", onShow),
            Keyboard.addListener("keyboardWillHide", onHide),
          ]
        : [
            Keyboard.addListener("keyboardDidShow", onShow),
            Keyboard.addListener("keyboardDidHide", onHide),
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
      <KeyboardContext value={{ overlap, avoiding: avoid }}>
        <View style={[styles.flex, avoid && { paddingBottom: overlap }]}>{children}</View>
      </KeyboardContext>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
