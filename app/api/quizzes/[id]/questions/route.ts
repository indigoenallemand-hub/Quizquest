import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicView } from "@/lib/question-resolver";
import { getSessionUserId } from "@/lib/session-user";
import { canAccessQuiz } from "@/lib/quiz-access";

// Returns the resolved, answer-safe question set for a full quiz session:
// CALCUL questions get fresh server-generated variables on every call.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  const themeId = new URL(request.url).searchParams.get("themeId");

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    select: {
      status: true,
      creatorId: true,
      themes: {
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

  const themes = selectedThemes.map(({ theme }) => ({
    id: theme.id,
    title: theme.title,
    questions: theme.questions.map((q) => ({ ...getPublicView(q), themeId: theme.id })),
  }));

  return NextResponse.json({ themes });
}
