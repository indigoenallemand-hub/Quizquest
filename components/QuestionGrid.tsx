"use client";

import { useEffect, useRef, useState } from "react";
import type { QuestionStatus } from "@/lib/status-summary";

const STATUS_LABEL: Record<QuestionStatus, string> = {
  correct: "juste",
  wrong: "faux",
  unanswered: "non repondue",
};

export interface GridCell {
  id: string;
  n: number;
  status: QuestionStatus;
  questionText: string;
  answerText: string | null;
}

// Total time budget to sweep across every cell whose status changed: more
// changed cells means a shorter delay between each one (clamped).
const SWEEP_BUDGET_MS = 1200;
const MIN_STEP_MS = 20;
const MAX_STEP_MS = 220;
const POP_MS = 350;

export default function QuestionGrid({ cells, entryStatuses }: { cells: GridCell[]; entryStatuses?: QuestionStatus[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const entryRef = useRef(entryStatuses);
  const [displayed, setDisplayed] = useState<QuestionStatus[]>(() => entryStatuses ?? cells.map((c) => c.status));
  const [popping, setPopping] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (openIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openIndex]);

  useEffect(() => {
    const entry = entryRef.current;
    if (!entry || entry.length !== cells.length) return;

    const changedIndexes: number[] = [];
    cells.forEach((c, i) => {
      if (entry[i] !== c.status) changedIndexes.push(i);
    });
    if (changedIndexes.length === 0) return;

    const step = Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, SWEEP_BUDGET_MS / changedIndexes.length));
    const timers = changedIndexes.map((i, order) =>
      setTimeout(() => {
        setDisplayed((prev) => {
          const next = [...prev];
          next[i] = cells[i].status;
          return next;
        });
        setPopping((prev) => new Set(prev).add(i));
        setTimeout(() => {
          setPopping((prev) => {
            const next = new Set(prev);
            next.delete(i);
            return next;
          });
        }, POP_MS);
      }, order * step)
    );

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cells.length === 0) return null;
  const openCell = openIndex !== null ? cells[openIndex] : null;

  return (
    <div className="qz-question-grid-wrap">
      <div className="qz-question-grid">
        {cells.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={`qz-question-grid-cell qz-question-grid-cell-${displayed[i]} ${popping.has(i) ? "qz-question-grid-cell-pop" : ""}`}
            title={`Question ${c.n} : ${STATUS_LABEL[c.status]}`}
            onClick={() => setOpenIndex(i)}
          />
        ))}
      </div>

      {openCell && (
        <div className="qz-question-grid-modal-backdrop" onClick={() => setOpenIndex(null)}>
          <div className="qz-question-grid-modal" onClick={(e) => e.stopPropagation()}>
            <button className="qz-question-grid-modal-close" onClick={() => setOpenIndex(null)} aria-label="Fermer">
              X
            </button>
            <span className={`qz-recap-badge qz-recap-badge-${openCell.status}`}>{STATUS_LABEL[openCell.status]}</span>
            <p className="qz-question-grid-modal-question">
              Question {openCell.n} — {openCell.questionText}
            </p>
            {openCell.answerText && (
              <p className="qz-question-grid-modal-answer">
                Bonne reponse : <strong>{openCell.answerText}</strong>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
