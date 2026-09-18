"use client";

import { useState } from "react";
import { DEFAULT_THEME_COLORS, type QuizThemeColors } from "@/lib/quiz-theme-style";

const FIELDS: { key: keyof QuizThemeColors; label: string }[] = [
  { key: "primary", label: "Primaire" },
  { key: "success", label: "Succes" },
  { key: "error", label: "Erreur" },
  { key: "warning", label: "Avertissement" },
];

export default function QuizThemeColorForm({ quizId, initialColors }: { quizId: string; initialColors: QuizThemeColors }) {
  const [colors, setColors] = useState<QuizThemeColors>(initialColors);
  const [saving, setSaving] = useState(false);

  async function save(next: QuizThemeColors) {
    setColors(next);
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem" }}>
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="qz-form-group" style={{ width: "auto" }}>
            <label>{label}</label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="color"
                value={colors[key] ?? DEFAULT_THEME_COLORS[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                style={{ width: "44px", height: "36px", padding: 0, border: "1.5px solid var(--qz-border)", borderRadius: "8px", cursor: "pointer" }}
              />
              <button type="button" className="qz-btn-quit" onClick={() => handleReset(key)} disabled={saving}>
                Reinitialiser
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
