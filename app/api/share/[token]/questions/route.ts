import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicView } from "@/lib/question-resolver";
import { readGuestAccess } from "@/lib/guest-access";
import { getQuestionStatuses } from "@/lib/question-progress";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const searchParams = new URL(request.url).searchParams;
  const themeId = searchParams.get("themeId");
  const withStatus = searchParams.get("status") === "1";

  const link = await prisma.guestAccess.findUnique({
    where: { token },
    select: {
      quiz: {
        select: {
          id: true,
          themes: {
            where: { enabled: true },
            orderBy: { order: "asc" },
            select: {
              theme: {
                select: {
                  id: true,
                  title: true,
                  questions: { select: { id: true, type: true, content: true, section: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!link) return NextResponse.json({ error: "Lien invalide." }, { status: 404 });

  const guestAccessId = await readGuestAccess(token);
  if (!guestAccessId) return NextResponse.json({ error: "Accès expiré." }, { status: 401 });

  const selectedThemes = themeId ? link.quiz.themes.filter((t) => t.theme.id === themeId) : link.quiz.themes;

  const statuses = withStatus
    ? await getQuestionStatuses({ guestAccessId }, selectedThemes.flatMap(({ theme }) => theme.questions.map((q) => q.id)))
    : undefined;

  const themes = selectedThemes.map(({ theme }) => ({
    id: theme.id,
    title: theme.title,
    questions: theme.questions.map((q) => ({ ...getPublicView(q), status: statuses?.get(q.id) })),
  }));

  return NextResponse.json({ themes });
}
