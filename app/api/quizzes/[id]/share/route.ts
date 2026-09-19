import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";

async function requireOwnedQuiz(id: string) {
  const userId = await getSessionUserId();
  if (!userId) return { error: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) } as const;

  const quiz = await prisma.quiz.findUnique({ where: { id }, select: { creatorId: true } });
  if (!quiz) return { error: NextResponse.json({ error: "Quiz introuvable." }, { status: 404 }) } as const;
  if (quiz.creatorId !== userId) return { error: NextResponse.json({ error: "Interdit." }, { status: 403 }) } as const;

  return { userId } as const;
}

// Generates (or regenerates) the quiz's share token. Regenerating revokes
// whatever link/QR/key was previously handed out: the old GuestAccess row
// (and its guest attempts) is dropped along with it.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireOwnedQuiz(id);
  if ("error" in check) return check.error;

  const body = await request.json().catch(() => ({}));
  const guestName = typeof body.guestName === "string" ? body.guestName.trim().slice(0, 100) || null : null;

  const shareToken = crypto.randomBytes(16).toString("hex");
  await prisma.$transaction([
    prisma.guestAccess.deleteMany({ where: { quizId: id } }),
    prisma.quiz.update({ where: { id }, data: { shareToken, guestName } }),
  ]);

  return NextResponse.json({ shareToken, guestName });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireOwnedQuiz(id);
  if ("error" in check) return check.error;

  await prisma.$transaction([
    prisma.guestAccess.deleteMany({ where: { quizId: id } }),
    prisma.quiz.update({ where: { id }, data: { shareToken: null, guestName: null } }),
  ]);

  return NextResponse.json({ shareToken: null, guestName: null });
}
