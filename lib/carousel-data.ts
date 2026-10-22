import { prisma } from "@/lib/prisma";
import { getQuestionStatuses, summarizeStatuses } from "@/lib/question-progress";
import { parseQuestionContent, getCorrectAnswerText } from "@/lib/question-resolver";
import type { CarouselChapter } from "@/components/QuizCarousel";
import type { GridCell } from "@/components/QuestionGrid";
import type { QuestionType } from "@/lib/generated/prisma/enums";

interface QuestionRow {
  id: string;
  type: QuestionType;
  content: unknown;
}

interface ThemeWithQuestions {
  id: string;
  title: string;
  description: string | null;
  questions: QuestionRow[];
  // QuizTheme.parentThemeId: set when this theme is the "niveau 2" of another chapter.
  parentThemeId?: string | null;
}

function questionText(question: QuestionRow): string {
  if (question.type === "CALCUL") return "Question de calcul générée aléatoirement (énoncé différent à chaque tentative).";
  return parseQuestionContent(question).content.enonce;
}

// Shared between the owner's quiz carousel and the guest share-link
// carousel: per-chapter progress bar / grid data, plus badges (badges work
// the same way for both — see lib/badge-sync.ts).
// Level-2 themes aren't returned as chapters of their own: each one is
// attached as `level2` to its parent chapter (and dropped if that parent
// isn't in `themes`, e.g. because it was disabled).
export async function buildCarouselChapters(
  themes: ThemeWithQuestions[],
  identity: { userId: string } | { guestAccessId: string } | null
): Promise<CarouselChapter[]> {
  const chapters: CarouselChapter[] = [];
  const level2ByParent = new Map<string, CarouselChapter>();

  for (const theme of themes) {
    const questions = theme.questions;
    const statuses = identity ? await getQuestionStatuses(identity, questions.map((q) => q.id)) : new Map();
    const stats = summarizeStatuses(questions.map((q) => statuses.get(q.id) ?? "unanswered"));

    const badges = identity
      ? await prisma.badge.findMany({ where: { ...identity, themeId: theme.id }, select: { type: true } })
      : [];

    const cells: GridCell[] = questions.map((q, i) => ({
      id: q.id,
      n: i + 1,
      status: statuses.get(q.id) ?? "unanswered",
      questionText: questionText(q),
      answerText: q.type === "CALCUL" ? null : getCorrectAnswerText(q),
    }));

    const chapter: CarouselChapter = {
      id: theme.id,
      title: theme.title,
      description: theme.description,
      questionCount: questions.length,
      stats,
      earnedBadges: badges.map((b) => b.type),
      cells,
      level2: null,
    };
    if (theme.parentThemeId) level2ByParent.set(theme.parentThemeId, chapter);
    else chapters.push(chapter);
  }

  for (const chapter of chapters) chapter.level2 = level2ByParent.get(chapter.id) ?? null;
  return chapters;
}

// Every chapter including the level-2 ones, for totals such as getGlobalPoints().
export function flattenChapters(chapters: CarouselChapter[]): CarouselChapter[] {
  return chapters.flatMap((c) => (c.level2 ? [c, c.level2] : [c]));
}
