"use client";

import { use } from "react";
import QuizSession from "@/components/QuizSession";

export default function SessionPageClient({
  params,
  searchParams,
  isOwner,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; themeId?: string; section?: string; count?: string; points?: string; grid?: string }>;
  isOwner: boolean;
}) {
  const { id: quizId } = use(params);
  const { mode: modeParam, themeId, section, count, points, grid } = use(searchParams);
  const mode = modeParam === "QCM" || modeParam === "REPONSE_LIBRE" ? modeParam : "ENTRAINEMENT";

  const questionsUrl = themeId
    ? `/api/quizzes/${quizId}/questions?themeId=${themeId}`
    : `/api/quizzes/${quizId}/questions`;
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
      quizId={isOwner ? quizId : undefined}
    />
  );
}
