import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readGuestAccess } from "@/lib/guest-access";
import { buildThemeStyle } from "@/lib/quiz-theme-style";
import TrainingConfigForm, { type SectionOption } from "@/components/TrainingConfigForm";

export default async function SharedConfigureTrainingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ themeId?: string }>;
}) {
  const { token } = await params;
  const { themeId } = await searchParams;
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
    where: { id: themeId, quizzes: { some: { quizId: quiz.id } } },
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
        sessionUrl={`/share/${token}/session`}
        themeId={themeId}
        chapterTitle={theme.title}
        totalCount={theme.questions.length}
        sections={sections}
      />
    </div>
  );
}
