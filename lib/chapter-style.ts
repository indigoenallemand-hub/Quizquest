import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { buildThemeStyle, buildLevel2Style } from "@/lib/quiz-theme-style";

// The quiz's theme colors, plus the level-2 overrides when `themeId` is a
// "niveau 2" chapter of this quiz — so its training, session and recap pages
// keep the colors of its card in the carousel.
export async function buildChapterStyle(quizId: string, themeColors: unknown, themeId?: string): Promise<CSSProperties> {
  const base = buildThemeStyle(themeColors);
  if (!themeId) return base;
  const quizTheme = await prisma.quizTheme.findUnique({
    where: { quizId_themeId: { quizId, themeId } },
    select: { parentThemeId: true },
  });
  return quizTheme?.parentThemeId ? { ...base, ...buildLevel2Style(themeColors) } : base;
}
