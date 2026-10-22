import type { CSSProperties } from "react";

export interface QuizThemeColors {
  primary?: string;
  success?: string;
  error?: string;
  warning?: string;
  // "Niveau 2" chapters (see QuizTheme.parentThemeId) get their own accent
  // and card background, so they stand out from the level-1 carousel.
  level2Primary?: string;
  level2Card?: string;
}

export const DEFAULT_THEME_COLORS: Required<QuizThemeColors> = {
  primary: "#17889c",
  success: "#6b7f4f",
  error: "#993012",
  warning: "#d97706",
  level2Primary: "#7c3aed",
  level2Card: "#faf7ff",
};

const VAR_NAMES: Partial<Record<keyof QuizThemeColors, string>> = {
  primary: "--qz-primary",
  success: "--qz-success",
  error: "--qz-error",
  warning: "--qz-warning",
};

// Every `qz-` class in app/quiz-theme.css reads its colors from these CSS
// custom properties, so overriding them on a wrapping element is enough to
// re-theme an entire quiz's pages without touching any component.
export function buildThemeStyle(themeColors: unknown): CSSProperties {
  const colors = (themeColors as QuizThemeColors | null) ?? {};
  const style: Record<string, string> = {};
  for (const [key, varName] of Object.entries(VAR_NAMES) as [keyof QuizThemeColors, string][]) {
    const value = colors[key];
    if (value) style[varName] = value;
  }
  return style as CSSProperties;
}

// Overrides applied on top of buildThemeStyle() around a level-2 chapter
// (its carousel card, and its training/session/recap pages). Hover and light
// variants are derived from the chosen accent so one color picker is enough.
export function buildLevel2Style(themeColors: unknown): CSSProperties {
  const colors = (themeColors as QuizThemeColors | null) ?? {};
  const primary = colors.level2Primary ?? DEFAULT_THEME_COLORS.level2Primary;
  const card = colors.level2Card ?? DEFAULT_THEME_COLORS.level2Card;
  return {
    "--qz-primary": primary,
    "--qz-primary-hover": `color-mix(in srgb, ${primary} 80%, black)`,
    "--qz-primary-light": `color-mix(in srgb, ${primary} 14%, white)`,
    "--qz-card": card,
  } as CSSProperties;
}
