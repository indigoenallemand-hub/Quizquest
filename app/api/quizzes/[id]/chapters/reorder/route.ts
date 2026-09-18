import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";

const reorderSchema = z.object({ themeIds: z.array(z.string()).min(1) });

// Owner-only. Body is the full ordered list of theme ids for this quiz;
// position in the array becomes QuizTheme.order (0-based). Reorders only —
// the submitted id set must exactly match the quiz's current chapters.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    select: { creatorId: true, themes: { select: { themeId: true } } },
  });
  if (!quiz) return NextResponse.json({ error: "Quiz introuvable." }, { status: 404 });
  if (quiz.creatorId !== userId) return NextResponse.json({ error: "Interdit." }, { status: 403 });

  const parsed = reorderSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const current = new Set(quiz.themes.map((t) => t.themeId));
  const submitted = parsed.data.themeIds;
  const sameSet = submitted.length === current.size && submitted.every((themeId) => current.has(themeId));
  if (!sameSet) {
    return NextResponse.json({ error: "La liste de chapitres ne correspond pas au quiz." }, { status: 400 });
  }

  await prisma.$transaction(
    submitted.map((themeId, order) =>
      prisma.quizTheme.update({ where: { quizId_themeId: { quizId: id, themeId } }, data: { order } })
    )
  );

  return NextResponse.json({ ok: true });
}
