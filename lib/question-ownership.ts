import { prisma } from "@/lib/prisma";

// A theme's questions can only be managed by the creator of a quiz that
// includes that theme. Used to gate question create/update/delete.
export async function userOwnsThemeQuiz(userId: string, themeId: string): Promise<boolean> {
  const link = await prisma.quizTheme.findFirst({ where: { themeId, quiz: { creatorId: userId } } });
  return !!link;
}
