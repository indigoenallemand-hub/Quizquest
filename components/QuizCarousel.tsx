"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BadgeRow from "@/components/BadgeRow";
import RecapProgressBar from "@/components/RecapProgressBar";
import QuestionGrid, { type GridCell } from "@/components/QuestionGrid";
import { encodeGridSnapshot, decodeGridSnapshot } from "@/lib/grid-snapshot";
import { summarizeStatuses } from "@/lib/status-summary";

export interface CarouselChapter {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  stats: { correct: number; wrong: number; unanswered: number; total: number };
  earnedBadges: string[];
  cells: GridCell[];
}

export default function QuizCarousel({
  basePath,
  chapters,
  showBadges = true,
  reponseLibreBadgeEnabled = true,
  initialChapterId,
  pointsBefore,
  entryGrid,
}: {
  basePath: string;
  chapters: CarouselChapter[];
  showBadges?: boolean;
  reponseLibreBadgeEnabled?: boolean;
  initialChapterId?: string;
  pointsBefore?: number;
  entryGrid?: string;
}) {
  const initialIndex = Math.max(
    0,
    chapters.findIndex((c) => c.id === initialChapterId)
  );
  const [index, setIndex] = useState(initialIndex);
  const chapter = chapters[index];
  const earned = new Set(chapter.earnedBadges);
  const pointsSuffix = pointsBefore != null ? `&points=${pointsBefore}` : "";

  // The chapter/progress-grid/points-bar snapshot from just before this
  // session (carried through the URL) only animates once, for the chapter we
  // just came back to — not every time it's revisited via the arrows.
  const [snapshotShown, setSnapshotShown] = useState(false);
  const isInitialChapter = index === initialIndex;
  const showEntrySnapshot = isInitialChapter && !snapshotShown && !!entryGrid;

  useEffect(() => {
    if (!isInitialChapter || snapshotShown) return;
    const id = requestAnimationFrame(() => setSnapshotShown(true));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialChapter]);

  const entryStatuses = showEntrySnapshot && entryGrid ? decodeGridSnapshot(entryGrid) : undefined;
  const fromStats = entryStatuses && entryStatuses.length === chapter.cells.length ? summarizeStatuses(entryStatuses) : undefined;

  const gridSuffix = `&grid=${encodeGridSnapshot(chapter.cells.map((c) => c.status))}`;

  const goPrev = () => setIndex((i) => (i - 1 + chapters.length) % chapters.length);
  const goNext = () => setIndex((i) => (i + 1) % chapters.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
      <div className="qz-chapter-carousel">
        <button
          type="button"
          onClick={goPrev}
          disabled={chapters.length < 2}
          aria-label="Chapitre precedent"
          className="qz-chapter-arrow"
        >
          &lsaquo;
        </button>

        <div className="qz-chapter-card">
          <span className="qz-chapter-counter">
            Chapitre {index + 1} / {chapters.length}
          </span>
          <h2 className="qz-chapter-title">{chapter.title}</h2>
          {chapter.description && <p className="qz-chapter-questions-count">{chapter.description}</p>}
          <p className="qz-chapter-questions-count">{chapter.questionCount} questions</p>

          {showBadges && (
            <BadgeRow key={`badges-${chapter.id}`} earned={earned} reponseLibreBadgeEnabled={reponseLibreBadgeEnabled} />
          )}
          <RecapProgressBar key={`bar-${chapter.id}`} {...chapter.stats} fromStats={fromStats} />
          <QuestionGrid key={`grid-${chapter.id}`} cells={chapter.cells} entryStatuses={entryStatuses} />

          <div className="qz-chapter-actions">
            <Link href={`${basePath}/configure?themeId=${chapter.id}${pointsSuffix}${gridSuffix}`} className="qz-btn-primary">
              Entrainement &rarr;
            </Link>
            <Link href={`${basePath}/session?mode=QCM&themeId=${chapter.id}${pointsSuffix}${gridSuffix}`} className="qz-btn-secondary">
              Test complet du chapitre (QCM)
            </Link>
            <Link
              href={`${basePath}/session?mode=REPONSE_LIBRE&themeId=${chapter.id}${pointsSuffix}${gridSuffix}`}
              className="qz-btn-secondary"
            >
              Reponse libre
            </Link>
            <Link href={`${basePath}/progress?themeId=${chapter.id}`} className="qz-btn-secondary">
              Recapitulatif
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={chapters.length < 2}
          aria-label="Chapitre suivant"
          className="qz-chapter-arrow"
        >
          &rsaquo;
        </button>
      </div>

      <div className="qz-chapter-dots">
        {chapters.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Aller au chapitre ${i + 1}`}
            className={`qz-chapter-dot ${i === index ? "is-active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
