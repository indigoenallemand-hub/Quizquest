"use client";

import { useState } from "react";

export default function ChapterDescriptionForm({
  quizId,
  themeId,
  initialDescription,
}: {
  quizId: string;
  themeId: string;
  initialDescription: string;
}) {
  const [description, setDescription] = useState(initialDescription);
  const [saved, setSaved] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const res = await fetch(`/api/quizzes/${quizId}/chapters/${themeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    if (res.ok) {
      setSaved(description.trim());
      setDescription(description.trim());
      setStatus({ ok: true, message: "Description enregistrée." });
    } else {
      setStatus({ ok: false, message: "Échec de l'enregistrement de la description." });
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="qz-start-card" style={{ maxWidth: "100%" }}>
      <h2 style={{ fontWeight: 700 }}>Description du chapitre</h2>
      <p style={{ fontSize: "0.8125rem", color: "var(--qz-muted)" }}>
        Affichée sous le titre du chapitre dans la sélection de chapitres. Laissez vide pour ne rien afficher.
      </p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={1000}
        rows={3}
        style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1.5px solid var(--qz-border)", borderRadius: "8px" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button type="submit" className="qz-btn-quit" disabled={saving || description.trim() === saved}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {status && (
          <span style={{ fontSize: "0.8rem", color: status.ok ? "var(--qz-muted)" : "var(--qz-error)" }}>{status.message}</span>
        )}
      </div>
    </form>
  );
}
