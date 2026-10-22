import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { buildChapterStyle } from "@/lib/chapter-style";
import SessionPageClient from "./SessionPageClient";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; themeId?: string; section?: string; count?: string; missed?: string; points?: string; grid?: string }>;
}) {
  const { id } = await params;
  const { themeId } = await searchParams;
  const [userId, quiz] = await Promise.all([
    getSessionUserId(),
    prisma.quiz.findUnique({ where: { id }, select: { themeColors: true, creatorId: true } }),
  ]);
  const isOwner = !!quiz && quiz.creatorId === userId;

  return (
    <div style={await buildChapterStyle(id, quiz?.themeColors, themeId)}>
      <SessionPageClient params={params} searchParams={searchParams} isOwner={isOwner} />
    </div>
  );
}
