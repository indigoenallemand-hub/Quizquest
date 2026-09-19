import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";

async function requireOwnedLink(id: string, linkId: string) {
  const userId = await getSessionUserId();
  if (!userId) return { error: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) } as const;

  const link = await prisma.guestAccess.findUnique({ where: { id: linkId }, select: { quizId: true, quiz: { select: { creatorId: true } } } });
  if (!link || link.quizId !== id) return { error: NextResponse.json({ error: "Lien introuvable." }, { status: 404 }) } as const;
  if (link.quiz.creatorId !== userId) return { error: NextResponse.json({ error: "Interdit." }, { status: 403 }) } as const;

  return { userId } as const;
}

// Revokes one specific share link (and drops its guest's attempts).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const { id, linkId } = await params;
  const check = await requireOwnedLink(id, linkId);
  if ("error" in check) return check.error;

  await prisma.guestAccess.delete({ where: { id: linkId } });
  return NextResponse.json({ ok: true });
}

// Regenerates a link's token in place: the old URL/QR stops working and its
// guest's attempts are cleared, but the row (and its name) is kept.
export async function PUT(_request: Request, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const { id, linkId } = await params;
  const check = await requireOwnedLink(id, linkId);
  if ("error" in check) return check.error;

  const link = await prisma.$transaction(async (tx) => {
    await tx.attempt.deleteMany({ where: { guestAccessId: linkId } });
    return tx.guestAccess.update({
      where: { id: linkId },
      data: { token: crypto.randomBytes(16).toString("hex"), activeToken: crypto.randomBytes(24).toString("hex") },
      select: { id: true, token: true, guestName: true },
    });
  });

  return NextResponse.json({ link });
}
