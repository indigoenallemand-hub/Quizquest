import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { getPublicView } from "@/lib/question-resolver";
import { questionInputSchema } from "@/lib/schemas";
import { userOwnsThemeQuiz } from "@/lib/question-ownership";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const question = await prisma.question.findUnique({
    where: { id },
    select: { id: true, type: true, content: true },
  });
  if (!question) return NextResponse.json({ error: "Question introuvable." }, { status: 404 });
  return NextResponse.json({ question: getPublicView(question) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.question.findUnique({ where: { id }, select: { themeId: true } });
  if (!existing) return NextResponse.json({ error: "Question introuvable." }, { status: 404 });
  if (!(await userOwnsThemeQuiz(userId, existing.themeId))) {
    return NextResponse.json({ error: "Interdit." }, { status: 403 });
  }

  // Discriminated union on `type`, so updates replace type+content together
  // rather than supporting partial field-by-field patches.
  const parsed = questionInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const question = await prisma.question.update({
    where: { id },
    data: { type: parsed.data.type, content: parsed.data.content, section: parsed.data.section },
  });
  return NextResponse.json({ question });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.question.findUnique({ where: { id }, select: { themeId: true } });
  if (!existing) return NextResponse.json({ error: "Question introuvable." }, { status: 404 });
  if (!(await userOwnsThemeQuiz(userId, existing.themeId))) {
    return NextResponse.json({ error: "Interdit." }, { status: 403 });
  }

  await prisma.question.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
