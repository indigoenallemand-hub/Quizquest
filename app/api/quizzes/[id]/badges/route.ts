import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";

const badgeSettingsSchema = z.object({
  reponseLibreBadgeEnabled: z.boolean(),
});

// Owner-only. Toggles whether this quiz's "Reponse libre parfaite" badge is
// shown and counted toward the points maximum.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id }, select: { creatorId: true } });
  if (!quiz) return NextResponse.json({ error: "Quiz introuvable." }, { status: 404 });
  if (quiz.creatorId !== userId) return NextResponse.json({ error: "Interdit." }, { status: 403 });

  const parsed = badgeSettingsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.quiz.update({
    where: { id },
    data: { reponseLibreBadgeEnabled: parsed.data.reponseLibreBadgeEnabled },
    select: { reponseLibreBadgeEnabled: true },
  });

  return NextResponse.json(updated);
}
