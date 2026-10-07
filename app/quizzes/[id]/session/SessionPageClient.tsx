"use client";

import { use } from "react";
import QuizSession from "@/components/QuizSession";

export default function SessionPageClient({
  params,
  searchParams,
  isOwner,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; themeId?: string; section?: string; count?: string; missed?: string; points?: string; grid?: string }>;
  isOwner: boolean;
}) {
  const { id: quizId } = use(params);
  const { mode: modeParam, themeId, section, count, missed, points, grid } = use(searchParams);
  const mode = modeParam === "QCM" || modeParam === "REPONSE_LIBRE" ? modeParam : "ENTRAINEMENT";
  const onlyMissed = mode === "ENTRAINEMENT" && missed === "1";

  const questionsParams = new URLSearchParams();
  if (themeId) questionsParams.set("themeId", themeId);
  if (onlyMissed) questionsParams.set("status", "1");
  const questionsUrl = `/api/quizzes/${quizId}/questions${questionsParams.size ? `?${questionsParams.toString()}` : ""}`;
  const backParams = new URLSearchParams();
  if (themeId) backParams.set("chapter", themeId);
  if (points) backParams.set("points", points);
  if (grid) backParams.set("grid", grid);
  const backHref = `/quizzes/${quizId}${backParams.size ? `?${backParams.toString()}` : ""}`;

  return (
    <QuizSession
      mode={mode}
      questionsUrl={questionsUrl}
      attemptsUrl="/api/attempts"
      backHref={backHref}
      section={section}
      count={count ? Number(count) : undefined}
      onlyMissed={onlyMissed}
      quizId={isOwner ? quizId : undefined}
    />
  );
}
