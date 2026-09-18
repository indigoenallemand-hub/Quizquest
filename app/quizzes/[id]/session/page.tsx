import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { buildThemeStyle } from "@/lib/quiz-theme-style";
import SessionPageClient from "./SessionPageClient";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; themeId?: string; section?: string; count?: string; points?: string; grid?: string }>;
}) {
  const { id } = await params;
  const [userId, quiz] = await Promise.all([
    getSessionUserId(),
    prisma.quiz.findUnique({ where: { id }, select: { themeColors: true, creatorId: true } }),
  ]);
  const isOwner = !!quiz && quiz.creatorId === userId;

  return (
    <div style={buildThemeStyle(quiz?.themeColors)}>
      <SessionPageClient params={params} searchParams={searchParams} isOwner={isOwner} />
    </div>
  );
}
