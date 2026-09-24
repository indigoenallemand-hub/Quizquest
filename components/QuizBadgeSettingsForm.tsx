"use client";

import { useState } from "react";

export default function QuizBadgeSettingsForm({
  quizId,
  initialReponseLibreBadgeEnabled,
}: {
  quizId: string;
  initialReponseLibreBadgeEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialReponseLibreBadgeEnabled);
  const [saving, setSaving] = useState(false);

  async function toggle(next: boolean) {
    setEnabled(next);
    setSaving(true);
    await fetch(`/api/quizzes/${quizId}/badges`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reponseLibreBadgeEnabled: next }),
    });
    setSaving(false);
  }

  return (
    <div className="qz-start-card" style={{ maxWidth: "100%" }}>
      <h2 style={{ fontWeight: 700 }}>Badges</h2>
      <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
          disabled={saving}
          style={{ width: "18px", height: "18px" }}
        />
        <span>
          Activer le badge &laquo;&nbsp;Reponse libre parfaite&nbsp;&raquo;
          <br />
          <span style={{ fontSize: "0.8125rem", color: "var(--qz-muted)" }}>
            Desactive, il n&apos;apparait plus dans la liste des badges et n&apos;est plus compte dans le maximum de points.
          </span>
        </span>
      </label>
    </div>
  );
}
