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
}

function questionText(question: QuestionRow): string {
  if (question.type === "CALCUL") return "Question de calcul générée aléatoirement (énoncé différent à chaque tentative).";
  return parseQuestionContent(question).content.enonce;
}

// Shared between the owner's quiz carousel and the guest share-link carousel:
// per-chapter progress bar / grid data, plus badges (owner only — guests
// don't have an account to earn them against).
export async function buildCarouselChapters(
  themes: ThemeWithQuestions[],
  identity: { userId: string } | { guestAccessId: string } | null
): Promise<CarouselChapter[]> {
  const chapters: CarouselChapter[] = [];

  for (const theme of themes) {
    const questions = theme.questions;
    const statuses = identity ? await getQuestionStatuses(identity, questions.map((q) => q.id)) : new Map();
    const stats = summarizeStatuses(questions.map((q) => statuses.get(q.id) ?? "unanswered"));

    const badges =
      identity && "userId" in identity
        ? await prisma.badge.findMany({ where: { userId: identity.userId, themeId: theme.id }, select: { type: true } })
        : [];

    const cells: GridCell[] = questions.map((q, i) => ({
      id: q.id,
      n: i + 1,
      status: statuses.get(q.id) ?? "unanswered",
      questionText: questionText(q),
      answerText: q.type === "CALCUL" ? null : getCorrectAnswerText(q),
    }));

    chapters.push({
      id: theme.id,
      title: theme.title,
      description: theme.description,
      questionCount: questions.length,
      stats,
      earnedBadges: badges.map((b) => b.type),
      cells,
    });
  }

  return chapters;
}
