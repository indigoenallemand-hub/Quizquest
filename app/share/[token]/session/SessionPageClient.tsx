"use client";

import { use } from "react";
import QuizSession from "@/components/QuizSession";

export default function SessionPageClient({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mode?: string; themeId?: string; section?: string; count?: string; missed?: string; points?: string; grid?: string }>;
}) {
  const { token } = use(params);
  const { mode: modeParam, themeId, section, count, missed, points, grid } = use(searchParams);
  // mode=EXAM is "LE TEST": graded like a QCM session, see QuizSession's `exam`.
  const exam = modeParam === "EXAM";
  const mode = exam ? "QCM" : modeParam === "QCM" || modeParam === "REPONSE_LIBRE" ? modeParam : "ENTRAINEMENT";
  const onlyMissed = mode === "ENTRAINEMENT" && missed === "1";

  const questionsParams = new URLSearchParams();
  if (exam) questionsParams.set("exam", "1");
  else if (themeId) questionsParams.set("themeId", themeId);
  if (onlyMissed) questionsParams.set("status", "1");
  const questionsUrl = `/api/share/${token}/questions${questionsParams.size ? `?${questionsParams.toString()}` : ""}`;
  const backParams = new URLSearchParams();
  if (themeId) backParams.set("chapter", themeId);
  if (points) backParams.set("points", points);
  if (grid) backParams.set("grid", grid);
  const backHref = `/share/${token}/play${backParams.size ? `?${backParams.toString()}` : ""}`;

  return (
    <QuizSession
      mode={mode}
      questionsUrl={questionsUrl}
      attemptsUrl={`/api/share/${token}/attempts`}
      backHref={backHref}
      section={section}
      count={count ? Number(count) : undefined}
      onlyMissed={onlyMissed}
      exam={exam}
      allowComment={!exam}
    />
  );
}
