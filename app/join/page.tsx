"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage() {
  const [key, setKey] = useState("");
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = key.trim();
    if (trimmed) router.push(`/share/${trimmed}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-6 py-16">
      <h1 className="text-2xl font-semibold">Rejoindre un quiz</h1>
      <p className="mt-2 text-sm text-zinc-600">Entrez la clé d&apos;accès qu&apos;on vous a communiquée.</p>
      <form onSubmit={submit} className="mt-6 flex gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Clé d'accès"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          Accéder
        </button>
      </form>
    </div>
  );
}
