"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function QuestionListActions({ questionId, editHref }: { questionId: string; editHref: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Supprimer cette question ? Cette action est irreversible.")) return;
    setDeleting(true);
    await fetch(`/api/questions/${questionId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <Link href={editHref} className="qz-btn-quit">
        Modifier
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="qz-btn-quit"
        style={{ color: "var(--qz-error)", borderColor: "var(--qz-error-light)" }}
      >
        {deleting ? "..." : "Supprimer"}
      </button>
    </div>
  );
}
