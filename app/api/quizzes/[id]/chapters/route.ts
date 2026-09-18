import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";

const createChapterSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

// Owner-only. Creates a new Theme (chapter) and appends it to this quiz at
// the last position.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    select: { creatorId: true, themes: { select: { order: true } } },
  });
  if (!quiz) return NextResponse.json({ error: "Quiz introuvable." }, { status: 404 });
  if (quiz.creatorId !== userId) return NextResponse.json({ error: "Interdit." }, { status: 403 });

  const parsed = createChapterSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const nextOrder = quiz.themes.reduce((max, t) => Math.max(max, t.order + 1), 0);
  const theme = await prisma.theme.create({
    data: {
      ...parsed.data,
      quizzes: { create: { quizId: id, order: nextOrder } },
    },
    select: { id: true, title: true, _count: { select: { questions: true } } },
  });

  return NextResponse.json({ theme }, { status: 201 });
}
