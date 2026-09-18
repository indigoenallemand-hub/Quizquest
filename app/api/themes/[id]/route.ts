import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const theme = await prisma.theme.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      questions: { select: { id: true, type: true } },
    },
  });
  if (!theme) return NextResponse.json({ error: "Thème introuvable." }, { status: 404 });
  return NextResponse.json({ theme });
}

const updateThemeSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const parsed = updateThemeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const theme = await prisma.theme.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ theme });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  await prisma.theme.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
