import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readGuestAccess } from "@/lib/guest-access";
import { buildThemeStyle } from "@/lib/quiz-theme-style";
import DuelScreen from "@/components/DuelScreen";

export default async function SharedDuelPage({ params }: { params: Promise<{ token: string; duelId: string }> }) {
  const { token, duelId } = await params;
  const link = await prisma.guestAccess.findUnique({ where: { token }, select: { quiz: { select: { themeColors: true } } } });
  if (!link) notFound();
  // Without a valid share cookie the play page explains how to get back in.
  if (!(await readGuestAccess(token))) redirect(`/share/${token}/play`);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10" style={buildThemeStyle(link.quiz.themeColors)}>
      <DuelScreen token={token} duelId={duelId} />
    </div>
  );
}
