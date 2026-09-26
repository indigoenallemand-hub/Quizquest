import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";

const updateChapterSchema = z.object({
  enabled: z.boolean().optional(),
  // Empty string clears the description.
  description: z.string().max(1000).optional(),
});

// Owner-only. `enabled` is per quiz (QuizTheme); `description` lives on the
// Theme itself.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; themeId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id, themeId } = await params;
  const link = await prisma.quizTheme.findUnique({
    where: { quizId_themeId: { quizId: id, themeId } },
    select: { quiz: { select: { creatorId: true } } },
  });
  if (!link) return NextResponse.json({ error: "Chapitre introuvable." }, { status: 404 });
  if (link.quiz.creatorId !== userId) return NextResponse.json({ error: "Interdit." }, { status: 403 });

  const parsed = updateChapterSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { enabled, description } = parsed.data;

  await prisma.$transaction([
    ...(enabled === undefined
      ? []
      : [prisma.quizTheme.update({ where: { quizId_themeId: { quizId: id, themeId } }, data: { enabled } })]),
    ...(description === undefined
      ? []
      : [prisma.theme.update({ where: { id: themeId }, data: { description: description.trim() || null } })]),
  ]);

  return NextResponse.json({ ok: true });
}
