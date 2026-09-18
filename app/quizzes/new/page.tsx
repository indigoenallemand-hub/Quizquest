"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewQuizPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const themeRes = await fetch("/api/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: chapterTitle }),
    });
    if (!themeRes.ok) {
      setError("Impossible de créer le premier chapitre.");
      setLoading(false);
      return;
    }
    const { theme } = await themeRes.json();

    const quizRes = await fetch("/api/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        themeIds: [theme.id],
      }),
    });
    if (!quizRes.ok) {
      setError("Impossible de créer le quiz.");
      setLoading(false);
      return;
    }
    const { quiz } = await quizRes.json();

    router.push(`/quizzes/${quiz.id}/edit`);
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col px-6 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Nouveau quiz</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Titre
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description (optionnel)
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Premier chapitre
          <input
            type="text"
            required
            value={chapterTitle}
            onChange={(e) => setChapterTitle(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Création..." : "Créer le quiz"}
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-600">
        <Link href="/quizzes" className="underline">Retour à mes quizzes</Link>
      </p>
    </div>
  );
}
