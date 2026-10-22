"use client";

import { useEffect, useRef, useState, type CSSProperties, type Ref } from "react";
import Link from "next/link";
import BadgeRow from "@/components/BadgeRow";
import RecapProgressBar from "@/components/RecapProgressBar";
import QuestionGrid, { type GridCell } from "@/components/QuestionGrid";
import { encodeGridSnapshot, decodeGridSnapshot } from "@/lib/grid-snapshot";
import { summarizeStatuses } from "@/lib/status-summary";
import type { QuestionStatus } from "@/lib/status-summary";

export interface CarouselChapter {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  stats: { correct: number; wrong: number; unanswered: number; total: number };
  earnedBadges: string[];
  cells: GridCell[];
  // "Niveau 2" of this chapter (QuizTheme.parentThemeId), shown under the
  // carousel once every badge of this chapter is earned.
  level2: CarouselChapter | null;
}

// Every badge shown for the chapter must be earned to unlock its level 2.
function hasAllBadges(chapter: CarouselChapter, reponseLibreBadgeEnabled: boolean): boolean {
  const required = reponseLibreBadgeEnabled ? ["EXPLORATEUR", "QCM", "REPONSE_LIBRE"] : ["EXPLORATEUR", "QCM"];
  return required.every((type) => chapter.earnedBadges.includes(type));
}

function ChapterCard({
  chapter,
  counter,
  basePath,
  pointsSuffix,
  showBadges,
  reponseLibreBadgeEnabled,
  entryStatuses,
  className = "",
  style,
  cardRef,
}: {
  chapter: CarouselChapter;
  counter: string;
  basePath: string;
  pointsSuffix: string;
  showBadges: boolean;
  reponseLibreBadgeEnabled: boolean;
  entryStatuses?: QuestionStatus[];
  className?: string;
  style?: CSSProperties;
  cardRef?: Ref<HTMLDivElement>;
}) {
  const earned = new Set(chapter.earnedBadges);
  const fromStats = entryStatuses && entryStatuses.length === chapter.cells.length ? summarizeStatuses(entryStatuses) : undefined;
  const gridSuffix = `&grid=${encodeGridSnapshot(chapter.cells.map((c) => c.status))}`;

  return (
    <div ref={cardRef} className={`qz-chapter-card ${className}`} style={style}>
      <span className="qz-chapter-counter">{counter}</span>
      <h2 className="qz-chapter-title">{chapter.title}</h2>
      {chapter.description && <p className="qz-chapter-questions-count">{chapter.description}</p>}
      <p className="qz-chapter-questions-count">{chapter.questionCount} questions</p>

      {showBadges && <BadgeRow key={`badges-${chapter.id}`} earned={earned} reponseLibreBadgeEnabled={reponseLibreBadgeEnabled} />}
      <RecapProgressBar key={`bar-${chapter.id}`} {...chapter.stats} fromStats={fromStats} />
      <QuestionGrid key={`grid-${chapter.id}`} cells={chapter.cells} entryStatuses={entryStatuses} />

      <div className="qz-chapter-actions">
        <Link href={`${basePath}/configure?themeId=${chapter.id}${pointsSuffix}${gridSuffix}`} className="qz-btn-primary">
          Entrainement &rarr;
        </Link>
        <Link href={`${basePath}/session?mode=QCM&themeId=${chapter.id}${pointsSuffix}${gridSuffix}`} className="qz-btn-secondary">
          Test complet du chapitre (QCM)
        </Link>
        <Link href={`${basePath}/session?mode=REPONSE_LIBRE&themeId=${chapter.id}${pointsSuffix}${gridSuffix}`} className="qz-btn-secondary">
          Reponse libre
        </Link>
        <Link href={`${basePath}/progress?themeId=${chapter.id}`} className="qz-btn-secondary">
          Recapitulatif
        </Link>
      </div>
    </div>
  );
}

export default function QuizCarousel({
  basePath,
  chapters,
  showBadges = true,
  reponseLibreBadgeEnabled = true,
  initialChapterId,
  pointsBefore,
  entryGrid,
  level2Style,
  alwaysUnlockLevel2 = false,
}: {
  basePath: string;
  chapters: CarouselChapter[];
  showBadges?: boolean;
  reponseLibreBadgeEnabled?: boolean;
  initialChapterId?: string;
  pointsBefore?: number;
  entryGrid?: string;
  // CSS variable overrides for the level-2 card (lib/quiz-theme-style.ts buildLevel2Style).
  level2Style?: CSSProperties;
  // The quiz creator sees level 2 without having to earn the badges first.
  alwaysUnlockLevel2?: boolean;
}) {
  // initialChapterId may point at a level-2 chapter (coming back from one of
  // its sessions): open its parent, then scroll down to it.
  const initialIndex = Math.max(
    0,
    chapters.findIndex((c) => c.id === initialChapterId || c.level2?.id === initialChapterId)
  );
  const initialIsLevel2 = !!initialChapterId && chapters[initialIndex]?.level2?.id === initialChapterId;
  const [index, setIndex] = useState(initialIndex);
  const chapter = chapters[index];
  const pointsSuffix = pointsBefore != null ? `&points=${pointsBefore}` : "";
  const level2Ref = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (initialIsLevel2) level2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialIsLevel2]);

  const entryStatuses = showEntrySnapshot && entryGrid ? decodeGridSnapshot(entryGrid) : undefined;
  const mainEntryStatuses = initialIsLevel2 ? undefined : entryStatuses;
  const level2EntryStatuses = initialIsLevel2 ? entryStatuses : undefined;

  const level2 = chapter.level2;
  const level2Unlocked = !!level2 && (alwaysUnlockLevel2 || hasAllBadges(chapter, reponseLibreBadgeEnabled));

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

        <ChapterCard
          chapter={chapter}
          counter={`Chapitre ${index + 1} / ${chapters.length}`}
          basePath={basePath}
          pointsSuffix={pointsSuffix}
          showBadges={showBadges}
          reponseLibreBadgeEnabled={reponseLibreBadgeEnabled}
          entryStatuses={mainEntryStatuses}
        />

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

      {level2 && level2Unlocked && (
        <div className="qz-level2-section" style={level2Style}>
          <button
            type="button"
            className="qz-level2-hint"
            onClick={() => level2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Niveau 2 debloque
            <span className="qz-level2-hint-arrow" aria-hidden>
              &darr;
            </span>
          </button>
          <ChapterCard
            key={level2.id}
            cardRef={level2Ref}
            chapter={level2}
            counter={`Niveau 2 · ${chapter.title}`}
            basePath={basePath}
            pointsSuffix={pointsSuffix}
            showBadges={showBadges}
            reponseLibreBadgeEnabled={reponseLibreBadgeEnabled}
            entryStatuses={level2EntryStatuses}
            className="qz-level2-card"
          />
        </div>
      )}

      {level2 && !level2Unlocked && (
        <div className="qz-level2-locked" style={level2Style}>
          <span aria-hidden>&#128274;</span>
          <div>
            <strong>Niveau 2 · {level2.questionCount} questions</strong>
            <p>Obtenez tous les badges de ce chapitre pour debloquer le niveau 2.</p>
          </div>
        </div>
      )}
    </div>
  );
}
