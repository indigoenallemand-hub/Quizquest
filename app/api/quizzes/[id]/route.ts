import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { canAccessQuiz } from "@/lib/quiz-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      themes: {
        orderBy: { order: "asc" },
        include: {
          theme: { select: { id: true, title: true, description: true, _count: { select: { questions: true } } } },
        },
      },
    },
  });
  if (!quiz || !canAccessQuiz(quiz, userId)) return NextResponse.json({ error: "Quiz introuvable." }, { status: 404 });
  return NextResponse.json({ quiz });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id }, select: { creatorId: true } });
  if (!quiz) return NextResponse.json({ error: "Quiz introuvable." }, { status: 404 });
  if (quiz.creatorId !== userId) return NextResponse.json({ error: "Interdit." }, { status: 403 });

  await prisma.quiz.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
