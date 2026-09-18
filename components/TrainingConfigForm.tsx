"use client";

import { useState } from "react";
import Link from "next/link";

export interface SectionOption {
  name: string;
  count: number;
}

// Snaps to a multiple of 5, except near the very top of the range where it
// snaps to `max` directly — otherwise a max that isn't itself a multiple of
// 5 (e.g. 32) could never be reached by dragging the slider all the way.
function snapCount(raw: number, min: number, max: number): number {
  if (raw >= max - 2) return max;
  return Math.max(min, Math.min(Math.round(raw / 5) * 5, max));
}

export default function TrainingConfigForm({
  sessionUrl,
  themeId,
  chapterTitle,
  totalCount,
  sections,
  pointsBefore,
  entryGrid,
}: {
  sessionUrl: string;
  themeId: string;
  chapterTitle: string;
  totalCount: number;
  sections: SectionOption[];
  pointsBefore?: number;
  entryGrid?: string;
}) {
  const [section, setSection] = useState("all");
  const [count, setCount] = useState(Math.min(20, totalCount));

  const available = section === "all" ? totalCount : (sections.find((s) => s.name === section)?.count ?? 0);
  const effectiveCount = Math.min(count, available);

  function handleSectionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const s = e.target.value;
    setSection(s);
    const avail = s === "all" ? totalCount : (sections.find((x) => x.name === s)?.count ?? 0);
    setCount((c) => Math.min(c, avail));
  }

  const pointsSuffix = pointsBefore != null ? `&points=${pointsBefore}` : "";
  const gridSuffix = entryGrid ? `&grid=${entryGrid}` : "";
  const href = `${sessionUrl}?mode=ENTRAINEMENT&themeId=${themeId}&section=${encodeURIComponent(section)}&count=${effectiveCount}${pointsSuffix}${gridSuffix}`;

  return (
    <div className="qz-start-header" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2rem" }}>
      <div>
        <h1 className="qz-start-title" style={{ fontSize: "1.75rem" }}>
          {chapterTitle}
        </h1>
        <p className="qz-start-subtitle">{totalCount} questions disponibles</p>
      </div>

      <div className="qz-start-card">
        <div className="qz-form-group">
          <label htmlFor="section">Section</label>
          <select id="section" className="qz-select" value={section} onChange={handleSectionChange}>
            <option value="all">Toutes les sections ({totalCount})</option>
            {sections.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
        </div>

        <div className="qz-form-group">
          <label htmlFor="count">
            Nombre de questions
            <span className="qz-count-badge">{effectiveCount}</span>
          </label>
          <input
            id="count"
            type="range"
            className="qz-range"
            min={Math.min(5, available)}
            max={Math.max(available, 1)}
            step={1}
            value={effectiveCount}
            onChange={(e) => setCount(snapCount(Number(e.target.value), Math.min(5, available), available))}
            disabled={available === 0}
          />
          <div className="qz-range-labels">
            <span>{Math.min(5, available)}</span>
            <span>{available} (toutes)</span>
          </div>
        </div>

        {available === 0 ? (
          <button type="button" className="qz-btn-primary" disabled>
            Aucune question disponible
          </button>
        ) : (
          <Link href={href} className="qz-btn-primary">
            Commencer le quiz &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
