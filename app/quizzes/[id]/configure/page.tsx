import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";
import { canAccessQuiz } from "@/lib/quiz-access";
import { buildThemeStyle } from "@/lib/quiz-theme-style";
import TrainingConfigForm, { type SectionOption } from "@/components/TrainingConfigForm";

export default async function ConfigureTrainingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ themeId?: string; points?: string; grid?: string }>;
}) {
  const { id } = await params;
  const { themeId, points, grid } = await searchParams;
  const userId = await getSessionUserId();
  if (!themeId) notFound();

  const quiz = await prisma.quiz.findUnique({ where: { id }, select: { status: true, creatorId: true, themeColors: true } });
  if (!quiz || !canAccessQuiz(quiz, userId)) notFound();

  const theme = await prisma.theme.findFirst({
    where: { id: themeId, quizzes: { some: { quizId: id, enabled: true } } },
    select: { title: true, questions: { select: { section: true } } },
  });
  if (!theme) notFound();

  const counts = new Map<string, number>();
  for (const q of theme.questions) {
    if (!q.section) continue;
    counts.set(q.section, (counts.get(q.section) ?? 0) + 1);
  }
  const sections: SectionOption[] = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10" style={buildThemeStyle(quiz.themeColors)}>
      <TrainingConfigForm
        sessionUrl={`/quizzes/${id}/session`}
        themeId={themeId}
        chapterTitle={theme.title}
        totalCount={theme.questions.length}
        sections={sections}
        pointsBefore={points ? Number(points) : undefined}
        entryGrid={grid}
      />
    </div>
  );
}
