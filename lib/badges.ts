export type BadgeType = "EXPLORATEUR" | "QCM" | "REPONSE_LIBRE";
export type AttemptMode = "ENTRAINEMENT" | "QCM" | "REPONSE_LIBRE";

export interface AttemptRecord {
  questionId: string;
  isCorrect: boolean;
  sessionId?: string | null;
  mode: AttemptMode;
}

// "explorateur": every question of the theme has been answered correctly at
// least once, cumulative across any number of attempts in any mode/order.
export function checkExplorateur(themeQuestionIds: string[], attempts: AttemptRecord[]): boolean {
  if (themeQuestionIds.length === 0) return false;
  const correctlyAnswered = new Set(attempts.filter((a) => a.isCorrect).map((a) => a.questionId));
  return themeQuestionIds.every((id) => correctlyAnswered.has(id));
}

// "qcm" / "reponse_libre": 100% correct across a single session (all of the
// theme's questions attempted together, identified by a shared sessionId).
// If a question was answered more than once within the same session, its
// most recent attempt in that session decides.
export function checkSessionBadge(themeQuestionIds: string[], sessionAttempts: AttemptRecord[]): boolean {
  if (themeQuestionIds.length === 0) return false;

  const bySession = new Map<string, Map<string, boolean>>();
  for (const attempt of sessionAttempts) {
    if (!attempt.sessionId) continue;
    let byQuestion = bySession.get(attempt.sessionId);
    if (!byQuestion) {
      byQuestion = new Map();
      bySession.set(attempt.sessionId, byQuestion);
    }
    byQuestion.set(attempt.questionId, attempt.isCorrect);
  }

  for (const byQuestion of bySession.values()) {
    const coversTheme = themeQuestionIds.every((id) => byQuestion.has(id));
    const allCorrect = themeQuestionIds.every((id) => byQuestion.get(id) === true);
    if (coversTheme && allCorrect) return true;
  }
  return false;
}

export function evaluateBadges(
  type: BadgeType,
  themeQuestionIds: string[],
  attempts: AttemptRecord[]
): boolean {
  switch (type) {
    case "EXPLORATEUR":
      return checkExplorateur(themeQuestionIds, attempts);
    case "QCM":
      return checkSessionBadge(
        themeQuestionIds,
        attempts.filter((a) => a.sessionId && a.mode === "QCM")
      );
    case "REPONSE_LIBRE":
      return checkSessionBadge(
        themeQuestionIds,
        attempts.filter((a) => a.sessionId && a.mode === "REPONSE_LIBRE")
      );
  }
}
