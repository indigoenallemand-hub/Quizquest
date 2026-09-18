"use client";

import { useEffect, useRef, useState } from "react";

interface Stats {
  correct: number;
  wrong: number;
  unanswered: number;
  total: number;
}

export default function RecapProgressBar({
  correct,
  wrong,
  unanswered,
  total,
  fromStats,
}: Stats & { fromStats?: Stats }) {
  const stats: Stats = { correct, wrong, unanswered, total };
  const fromRef = useRef(fromStats);
  const [display, setDisplay] = useState<Stats>(fromStats ?? stats);

  useEffect(() => {
    if (!fromRef.current) return;
    const raf = requestAnimationFrame(() => setDisplay(stats));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (total === 0) return null;
  const pct = (n: number) => (n / total) * 100;

  return (
    <div className="qz-recap-progress-bar">
      <div
        className="qz-recap-progress-segment qz-recap-progress-correct"
        style={{ width: `${pct(display.correct)}%` }}
        title={`${correct} question${correct > 1 ? "s" : ""} juste${correct > 1 ? "s" : ""}`}
      />
      <div
        className="qz-recap-progress-segment qz-recap-progress-wrong"
        style={{ width: `${pct(display.wrong)}%` }}
        title={`${wrong} question${wrong > 1 ? "s" : ""} fausse${wrong > 1 ? "s" : ""}`}
      />
      <div
        className="qz-recap-progress-segment qz-recap-progress-unanswered"
        style={{ width: `${pct(display.unanswered)}%` }}
        title={`${unanswered} question${unanswered > 1 ? "s" : ""} non repondue${unanswered > 1 ? "s" : ""}`}
      />
    </div>
  );
}
