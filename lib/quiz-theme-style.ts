import type { CSSProperties } from "react";

export interface QuizThemeColors {
  primary?: string;
  success?: string;
  error?: string;
  warning?: string;
}

export const DEFAULT_THEME_COLORS: Required<QuizThemeColors> = {
  primary: "#17889c",
  success: "#6b7f4f",
  error: "#993012",
  warning: "#d97706",
};

const VAR_NAMES: Record<keyof QuizThemeColors, string> = {
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
  for (const key of Object.keys(VAR_NAMES) as (keyof QuizThemeColors)[]) {
    const value = colors[key];
    if (value) style[VAR_NAMES[key]] = value;
  }
  return style as CSSProperties;
}
