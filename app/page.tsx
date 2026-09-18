import Link from "next/link";
import { getSessionUserId } from "@/lib/session-user";

export default async function Home() {
  const userId = await getSessionUserId();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Créez, partagez et révisez des quiz sur n&apos;importe quel sujet
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-zinc-600">
          Chaque utilisateur peut construire ses propres quiz — QCM, dates, calculs — les garder pour
          réviser en solo, ou les rendre publics pour que d&apos;autres les découvrent.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/quizzes"
            className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Découvrir les quizzes
          </Link>
          {!userId && (
            <Link
              href="/register"
              className="rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium hover:bg-zinc-50"
            >
              Créer un compte
            </Link>
          )}
        </div>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-medium">1. Créez</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Regroupez vos questions par thème et composez un quiz sur le sujet de votre choix.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-medium">2. Partagez</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Publiez votre quiz pour que tout le monde puisse s&apos;entraîner dessus, ou gardez-le
            privé pour votre usage personnel.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-medium">3. Progressez</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Suivez vos tentatives, mesurez votre progression par thème et débloquez des badges.
          </p>
        </div>
      </div>
    </div>
  );
}
