import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { Prisma } from "@/lib/generated/prisma/client";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const themeColorsSchema = z.object({
  primary: hexColor.nullable().optional(),
  success: hexColor.nullable().optional(),
  error: hexColor.nullable().optional(),
  warning: hexColor.nullable().optional(),
});

// Owner-only. Body keys set a custom color (hex), `null` resets that key back
// to the site default. Merges into the existing Quiz.themeColors JSON blob.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const quiz = await prisma.quiz.findUnique({ where: { id }, select: { creatorId: true, themeColors: true } });
  if (!quiz) return NextResponse.json({ error: "Quiz introuvable." }, { status: 404 });
  if (quiz.creatorId !== userId) return NextResponse.json({ error: "Interdit." }, { status: 403 });

  const parsed = themeColorsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = (quiz.themeColors as Record<string, string> | null) ?? {};
  const merged: Record<string, string> = { ...existing };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === null) delete merged[key];
    else if (value !== undefined) merged[key] = value;
  }

  const updated = await prisma.quiz.update({
    where: { id },
    data: { themeColors: Object.keys(merged).length > 0 ? merged : Prisma.DbNull },
  });
  return NextResponse.json({ themeColors: updated.themeColors });
}
