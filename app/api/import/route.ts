import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { quizImportSchema } from "@/lib/schemas";

// Accepts a full quiz + themes + questions JSON payload (see lib/schemas.ts
// for the exact shape) and inserts it in one transaction after zod validation.
// Each `themes[]` entry becomes its own Theme with its questions, linked to
// the new Quiz via the QuizTheme join table.
export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const parsed = quizImportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, description, imageUrl, status, themes } = parsed.data;

  const quiz = await prisma.$transaction(async (tx) => {
    const createdQuiz = await tx.quiz.create({
      data: { title, description, imageUrl, status, creatorId: userId },
    });

    for (const [order, themeInput] of themes.entries()) {
      const theme = await tx.theme.create({
        data: { title: themeInput.title, description: themeInput.description },
      });
      await tx.quizTheme.create({ data: { quizId: createdQuiz.id, themeId: theme.id, order } });
      await tx.question.createMany({
        data: themeInput.questions.map((q) => ({
          themeId: theme.id,
          type: q.type,
          content: q.content,
          section: q.section,
        })),
      });
    }

    return tx.quiz.findUniqueOrThrow({
      where: { id: createdQuiz.id },
      include: { themes: { orderBy: { order: "asc" }, include: { theme: { include: { questions: true } } } } },
    });
  });

  return NextResponse.json({ quiz }, { status: 201 });
}
