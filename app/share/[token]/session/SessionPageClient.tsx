"use client";

import { use } from "react";
import QuizSession from "@/components/QuizSession";

export default function SessionPageClient({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mode?: string; themeId?: string; section?: string; count?: string }>;
}) {
  const { token } = use(params);
  const { mode: modeParam, themeId, section, count } = use(searchParams);
  const mode = modeParam === "QCM" || modeParam === "REPONSE_LIBRE" ? modeParam : "ENTRAINEMENT";

  const questionsUrl = themeId
    ? `/api/share/${token}/questions?themeId=${themeId}`
    : `/api/share/${token}/questions`;
  const backHref = themeId ? `/share/${token}/play?chapter=${themeId}` : `/share/${token}/play`;

  return (
    <QuizSession
      mode={mode}
      questionsUrl={questionsUrl}
      attemptsUrl={`/api/share/${token}/attempts`}
      backHref={backHref}
      section={section}
      count={count ? Number(count) : undefined}
    />
  );
}
