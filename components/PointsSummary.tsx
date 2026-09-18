"use client";

import { useEffect, useState } from "react";
import { POINTS_PER_QUESTION, POINTS_PER_BADGE } from "@/lib/points";

const COUNT_ANIM_MS = 700;
const GAIN_BADGE_VISIBLE_MS = 1800;

export default function PointsSummary({
  earned,
  max,
  entryPoints,
}: {
  earned: number;
  max: number;
  entryPoints?: number;
}) {
  const [display, setDisplay] = useState(entryPoints ?? earned);
  const [gain, setGain] = useState(0);

  useEffect(() => {
    if (entryPoints == null) return;
    const gained = earned - entryPoints;
    if (gained <= 0) return;

    let raf = 0;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    raf = requestAnimationFrame(() => {
      setGain(gained);
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / COUNT_ANIM_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(Math.round(entryPoints + gained * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      hideTimer = setTimeout(() => setGain(0), GAIN_BADGE_VISIBLE_MS);
    });

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hideTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="qz-points-summary">
      <span className="qz-points-summary-icon">⭐</span>
      <span className="qz-points-summary-value">
        {display} / {max} pts
      </span>
      {gain > 0 && <span className="qz-points-gain-badge">+{gain} pts</span>}
      <div className="qz-points-summary-tooltip">
        <strong>Systeme de points</strong>
        <span>{POINTS_PER_QUESTION} pts par question deja repondue correctement</span>
        <span>{POINTS_PER_BADGE.EXPLORATEUR} pts par badge Explorateur</span>
        <span>{POINTS_PER_BADGE.QCM} pts par badge QCM</span>
        <span>{POINTS_PER_BADGE.REPONSE_LIBRE} pts par badge Reponse libre</span>
        <span>{max} pts maximum theorique pour ce quiz</span>
      </div>
    </div>
  );
}
