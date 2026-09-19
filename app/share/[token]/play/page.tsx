import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readGuestAccess } from "@/lib/guest-access";
import { buildCarouselChapters } from "@/lib/carousel-data";
import { buildThemeStyle } from "@/lib/quiz-theme-style";
import QuizCarousel from "@/components/QuizCarousel";

export default async function SharedQuizPlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ chapter?: string }>;
}) {
  const { token } = await params;
  const { chapter } = await searchParams;

  const link = await prisma.guestAccess.findUnique({
    where: { token },
    include: {
      quiz: {
        include: {
          themes: { orderBy: { order: "asc" }, include: { theme: { include: { questions: true } } } },
        },
      },
    },
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
        <p className="qz-start-subtitle mt-2">
          Ce lien a ete rouvert sur un autre appareil, ou vous n&apos;avez pas encore ouvert le lien de partage.
        </p>
        <Link href={`/share/${token}`} className="qz-btn-primary mt-6" style={{ display: "inline-block", width: "auto" }}>
          Reutiliser ce lien
        </Link>
      </div>
    );
  }

  const chapters = await buildCarouselChapters(
    quiz.themes.map((t) => t.theme),
    { guestAccessId }
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10" style={buildThemeStyle(quiz.themeColors)}>
      <div className="qz-start-header">
        <h1 className="qz-start-title">{quiz.title}</h1>
        {quiz.description && <p className="qz-start-subtitle">{quiz.description}</p>}
        <p className="qz-start-subtitle" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
          Vous testez ce quiz en tant qu&apos;invite, via un lien partage.
        </p>
      </div>

      <div className="mt-8">
        {chapters.length === 0 ? (
          <p className="text-center text-zinc-600">Ce quiz n&apos;a pas encore de chapitre.</p>
        ) : (
          <QuizCarousel basePath={`/share/${token}`} chapters={chapters} showBadges={false} initialChapterId={chapter} />
        )}
      </div>
    </div>
  );
}
