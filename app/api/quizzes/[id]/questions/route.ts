import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicView } from "@/lib/question-resolver";
import { getSessionUserId } from "@/lib/session-user";
import { canAccessQuiz } from "@/lib/quiz-access";
import { getQuestionStatuses } from "@/lib/question-progress";

// Returns the resolved, answer-safe question set for a full quiz session:
// CALCUL questions get fresh server-generated variables on every call.
// With ?status=1, each question also carries the caller's progress status
// (used by the "only missed questions" training option).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  const searchParams = new URL(request.url).searchParams;
  const themeId = searchParams.get("themeId");
  const withStatus = searchParams.get("status") === "1";

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    select: {
      status: true,
      creatorId: true,
      themes: {
        where: { enabled: true },
        orderBy: { order: "asc" },
        select: {
          theme: {
            select: {
              id: true,
              title: true,
              questions: { select: { id: true, type: true, content: true, section: true } },
            },
          },
        },
      },
    },
  });
  if (!quiz || !canAccessQuiz(quiz, userId)) return NextResponse.json({ error: "Quiz introuvable." }, { status: 404 });

  const selectedThemes = themeId ? quiz.themes.filter((t) => t.theme.id === themeId) : quiz.themes;

  const statuses =
    withStatus && userId
      ? await getQuestionStatuses({ userId }, selectedThemes.flatMap(({ theme }) => theme.questions.map((q) => q.id)))
      : undefined;

  const themes = selectedThemes.map(({ theme }) => ({
    id: theme.id,
    title: theme.title,
    questions: theme.questions.map((q) => ({ ...getPublicView(q), themeId: theme.id, status: statuses?.get(q.id) })),
  }));

  return NextResponse.json({ themes });
}
