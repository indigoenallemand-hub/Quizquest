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

// Lists the quiz's share links (one per person it's been shared with).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireOwnedQuiz(id);
  if ("error" in check) return check.error;

  const links = await prisma.guestAccess.findMany({
    where: { quizId: id },
    select: { id: true, token: true, guestName: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ links });
}

// Creates a new share link for the quiz, optionally labeled with the
// recipient's first name. Each link is independent: opening one doesn't
// affect any other link's cookie/progress.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireOwnedQuiz(id);
  if ("error" in check) return check.error;

  const body = await request.json().catch(() => ({}));
  const guestName = typeof body.guestName === "string" ? body.guestName.trim().slice(0, 100) || null : null;

  const link = await prisma.guestAccess.create({
    data: {
      quizId: id,
      token: crypto.randomBytes(16).toString("hex"),
      activeToken: crypto.randomBytes(24).toString("hex"),
      guestName,
    },
    select: { id: true, token: true, guestName: true },
  });

  return NextResponse.json({ link });
}
