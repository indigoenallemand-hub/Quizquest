import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readGuestAccess } from "@/lib/guest-access";
import { getQuestionStatuses } from "@/lib/question-progress";
import { buildThemeStyle } from "@/lib/quiz-theme-style";
import TrainingConfigForm, { type SectionOption } from "@/components/TrainingConfigForm";

export default async function SharedConfigureTrainingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ themeId?: string; points?: string; grid?: string }>;
}) {
  const { token } = await params;
  const { themeId, points, grid } = await searchParams;
  if (!themeId) notFound();

  const link = await prisma.guestAccess.findUnique({
    where: { token },
    select: { quiz: { select: { id: true, themeColors: true } } },
  });
  if (!link) notFound();
  const quiz = link.quiz;

  const guestAccessId = await readGuestAccess(token);
  if (!guestAccessId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
        <h1 className="qz-start-title" style={{ fontSize: "1.5rem" }}>
          Acces expire
        </h1>
        <p className="qz-start-subtitle mt-2">Reouvrez le lien de partage pour continuer.</p>
        <Link href={`/share/${token}`} className="qz-btn-primary mt-6" style={{ display: "inline-block", width: "auto" }}>
          Reutiliser ce lien
        </Link>
      </div>
    );
  }

  const theme = await prisma.theme.findFirst({
    where: { id: themeId, quizzes: { some: { quizId: quiz.id, enabled: true } } },
    select: { title: true, questions: { select: { id: true, section: true } } },
  });
  if (!theme) notFound();

  const statuses = await getQuestionStatuses({ guestAccessId }, theme.questions.map((q) => q.id));
  const isMissed = (id: string) => statuses?.get(id) !== "correct";

  const counts = new Map<string, { count: number; missed: number }>();
  for (const q of theme.questions) {
    if (!q.section) continue;
    const c = counts.get(q.section) ?? { count: 0, missed: 0 };
    counts.set(q.section, { count: c.count + 1, missed: c.missed + (isMissed(q.id) ? 1 : 0) });
  }
  const sections: SectionOption[] = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, c]) => ({ name, ...c }));
  const missedCount = statuses ? theme.questions.filter((q) => isMissed(q.id)).length : undefined;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10" style={buildThemeStyle(quiz.themeColors)}>
      <TrainingConfigForm
        sessionUrl={`/share/${token}/session`}
        themeId={themeId}
        chapterTitle={theme.title}
        totalCount={theme.questions.length}
        missedCount={missedCount}
        sections={sections}
        pointsBefore={points ? Number(points) : undefined}
        entryGrid={grid}
      />
    </div>
  );
}
