/** 4-pt spacing scale from docs/design.md §4. */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
} as const;

export const screenPadding = space.lg;

export const radius = {
  /** Badges, chips */
  sm: 8,
  /** Buttons, inputs */
  md: 12,
  /** Cards */
  lg: 16,
  /** Bottom sheets */
  xl: 24,
  pill: 999,
} as const;

/** Minimum touch target (44 × 44). */
export const minTouchTarget = 44;

export const iconSize = { sm: 20, md: 24 } as const;
export const iconStrokeWidth = 1.75;
