"use client";

import { useState } from "react";
import { DEFAULT_THEME_COLORS, type QuizThemeColors } from "@/lib/quiz-theme-style";

const FIELDS: { key: keyof QuizThemeColors; label: string }[] = [
  { key: "primary", label: "Primaire" },
  { key: "success", label: "Succes" },
  { key: "error", label: "Erreur" },
  { key: "warning", label: "Avertissement" },
];

const LEVEL2_FIELDS: { key: keyof QuizThemeColors; label: string }[] = [
  { key: "level2Primary", label: "Couleur principale" },
  { key: "level2Card", label: "Fond de la carte" },
];

export default function QuizThemeColorForm({ quizId, initialColors }: { quizId: string; initialColors: QuizThemeColors }) {
  const [colors, setColors] = useState<QuizThemeColors>(initialColors);
  const [saving, setSaving] = useState(false);

  // `next` only holds the changed key (null = reset), matching the PATCH
  // route's merge semantics; the local state is merged the same way.
  async function save(next: Record<string, string | null>) {
    setColors((prev) => {
      const merged: Record<string, string | undefined> = { ...prev };
      for (const [key, value] of Object.entries(next)) merged[key] = value ?? undefined;
      return merged as QuizThemeColors;
    });
    setSaving(true);
    await fetch(`/api/quizzes/${quizId}/theme`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setSaving(false);
  }

  function handleChange(key: keyof QuizThemeColors, value: string) {
    save({ [key]: value });
  }

  function handleReset(key: keyof QuizThemeColors) {
    save({ [key]: null });
  }

  return (
    <div className="qz-start-card" style={{ maxWidth: "100%" }}>
      <h2 style={{ fontWeight: 700 }}>Couleurs du quiz</h2>
      <ColorFields fields={FIELDS} colors={colors} saving={saving} onChange={handleChange} onReset={handleReset} />
      <h3 style={{ fontWeight: 600, marginTop: "0.5rem" }}>Chapitres niveau 2</h3>
      <p className="qz-chapter-questions-count" style={{ marginTop: "-0.25rem" }}>
        Couleurs du niveau 2, débloqué sous un chapitre une fois tous ses badges obtenus.
      </p>
      <ColorFields fields={LEVEL2_FIELDS} colors={colors} saving={saving} onChange={handleChange} onReset={handleReset} />
    </div>
  );
}

function ColorFields({
  fields,
  colors,
  saving,
  onChange,
  onReset,
}: {
  fields: { key: keyof QuizThemeColors; label: string }[];
  colors: QuizThemeColors;
  saving: boolean;
  onChange: (key: keyof QuizThemeColors, value: string) => void;
  onReset: (key: keyof QuizThemeColors) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem" }}>
      {fields.map(({ key, label }) => (
        <div key={key} className="qz-form-group" style={{ width: "auto" }}>
          <label>{label}</label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="color"
              value={colors[key] ?? DEFAULT_THEME_COLORS[key]}
              onChange={(e) => onChange(key, e.target.value)}
              style={{ width: "44px", height: "36px", padding: 0, border: "1.5px solid var(--qz-border)", borderRadius: "8px", cursor: "pointer" }}
            />
            <button type="button" className="qz-btn-quit" onClick={() => onReset(key)} disabled={saving}>
              Reinitialiser
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
