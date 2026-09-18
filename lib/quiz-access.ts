export function canAccessQuiz(quiz: { status: "PUBLIC" | "PRIVATE"; creatorId: string }, userId: string | null): boolean {
  return quiz.status === "PUBLIC" || quiz.creatorId === userId;
}
