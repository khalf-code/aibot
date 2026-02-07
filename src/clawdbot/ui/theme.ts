/**
 * UI-013 (#74) -- Dark mode polish
 *
 * Type definitions for the dashboard theming system. Supports light,
 * dark, and system-preference modes with customizable color tokens.
 */

// ---------------------------------------------------------------------------
// Theme mode
// ---------------------------------------------------------------------------

/**
 * Active theme mode.
 *
 * - `light`  -- explicit light theme
 * - `dark`   -- explicit dark theme
 * - `system` -- follow the operating system / browser preference
 */
export type ThemeMode = "light" | "dark" | "system";

// ---------------------------------------------------------------------------
// Color tokens
// ---------------------------------------------------------------------------

/** Core color tokens used throughout the dashboard UI. */
export type ThemeColors = {
  /** Primary background color (page body). */
  bgPrimary: string;
  /** Secondary background color (cards, panels). */
  bgSecondary: string;
  /** Tertiary background color (hover states, subtle fills). */
  bgTertiary: string;

  /** Primary text color. */
  textPrimary: string;
  /** Secondary text color (descriptions, labels). */
  textSecondary: string;
  /** Muted text color (placeholders, disabled). */
  textMuted: string;

  /** Brand accent color (links, primary buttons). */
  accent: string;
  /** Accent color on hover/active states. */
  accentHover: string;

  /** Border color for cards and dividers. */
  border: string;

  /** Success color (completed runs, healthy status). */
  success: string;
  /** Warning color (degraded health, approaching limits). */
  warning: string;
  /** Error/danger color (failed runs, down status). */
  danger: string;
  /** Informational color (badges, info alerts). */
  info: string;

  /** Sidebar background color. */
  sidebarBg: string;
  /** Sidebar text color. */
  sidebarText: string;
  /** Sidebar active item highlight color. */
  sidebarActiveItem: string;
};

// ---------------------------------------------------------------------------
// Preset palettes
// ---------------------------------------------------------------------------

/** Light theme color palette. */
export const LIGHT_COLORS: ThemeColors = {
  bgPrimary: "#ffffff",
  bgSecondary: "#f8f9fa",
  bgTertiary: "#e9ecef",
  textPrimary: "#1a1a2e",
  textSecondary: "#495057",
  textMuted: "#adb5bd",
  accent: "#4361ee",
  accentHover: "#3a56d4",
  border: "#dee2e6",
  success: "#2d9c4a",
  warning: "#e8a317",
  danger: "#dc3545",
  info: "#0ea5e9",
  sidebarBg: "#1a1a2e",
  sidebarText: "#e9ecef",
  sidebarActiveItem: "#4361ee",
};

/** Dark theme color palette. */
export const DARK_COLORS: ThemeColors = {
  bgPrimary: "#0f0f1a",
  bgSecondary: "#1a1a2e",
  bgTertiary: "#252540",
  textPrimary: "#e9ecef",
  textSecondary: "#adb5bd",
  textMuted: "#6c757d",
  accent: "#6c8cff",
  accentHover: "#8aa4ff",
  border: "#2d2d4a",
  success: "#3dd66f",
  warning: "#fbbf24",
  danger: "#f87171",
  info: "#38bdf8",
  sidebarBg: "#0a0a14",
  sidebarText: "#e9ecef",
  sidebarActiveItem: "#6c8cff",
};

// ---------------------------------------------------------------------------
// Theme configuration
// ---------------------------------------------------------------------------

/** Complete theme configuration. */
export type ThemeConfig = {
  /** Active theme mode. */
  mode: ThemeMode;
  /** Resolved color palette (based on mode and optional overrides). */
  colors: ThemeColors;
  /** User-provided color overrides (applied on top of the base palette). */
  overrides?: Partial<ThemeColors>;
  /** Border radius token in pixels (affects cards, buttons, inputs). */
  borderRadiusPx: number;
  /** Base font size in pixels. */
  fontSizePx: number;
  /** Whether to use reduced motion (respects prefers-reduced-motion). */
  reducedMotion: boolean;
  /** Whether high contrast mode is enabled. */
  highContrast: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective color palette for a given mode.
 *
 * When `mode` is `"system"`, the caller should detect the OS preference
 * and pass the resolved mode (`"light"` or `"dark"`).
 *
 * @param mode - The resolved theme mode (`"light"` or `"dark"`).
 * @param overrides - Optional partial color overrides.
 * @returns The merged color palette.
 */
export function resolveColors(
  mode: "light" | "dark",
  overrides?: Partial<ThemeColors>,
): ThemeColors {
  const base = mode === "dark" ? DARK_COLORS : LIGHT_COLORS;
  if (!overrides) {
    return { ...base };
  }
  return { ...base, ...overrides };
}

/** Default theme configuration (system mode, no overrides). */
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  mode: "system",
  colors: LIGHT_COLORS,
  borderRadiusPx: 8,
  fontSizePx: 14,
  reducedMotion: false,
  highContrast: false,
};
