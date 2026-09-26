import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session-user";

export default async function QuizzesPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const quizzes = await prisma.quiz.findMany({
    where: { creatorId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      themes: { where: { enabled: true }, select: { theme: { select: { _count: { select: { questions: true } } } } } },
    },
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mes quizzes</h1>
        <Link
          href="/quizzes/new"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          + Nouveau quiz
        </Link>
      </div>

      {quizzes.length === 0 ? (
        <p className="text-zinc-600">Vous n&apos;avez pas encore créé de quiz.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {quizzes.map((quiz) => {
            const questionCount = quiz.themes.reduce((sum, t) => sum + t.theme._count.questions, 0);
            return (
              <li key={quiz.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <Link href={`/quizzes/${quiz.id}`} className="block">
                  <h2 className="font-medium">{quiz.title}</h2>
                  {quiz.description && <p className="mt-1 text-sm text-zinc-600">{quiz.description}</p>}
                  <p className="mt-2 text-xs text-zinc-500">
                    {quiz.themes.length} chapitre{quiz.themes.length > 1 ? "s" : ""} · {questionCount} question
                    {questionCount > 1 ? "s" : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
