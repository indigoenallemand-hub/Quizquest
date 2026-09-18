import type { QuestionStatus } from "@/lib/status-summary";

// A chapter's per-question statuses, compressed to one character each, so it
// can travel through a URL query param across a full page navigation (there's
// no in-memory React state to carry it, unlike the local Electron app).
const CODES: Record<QuestionStatus, string> = { correct: "c", wrong: "w", unanswered: "u" };
const DECODE: Record<string, QuestionStatus> = { c: "correct", w: "wrong", u: "unanswered" };

export function encodeGridSnapshot(statuses: QuestionStatus[]): string {
  return statuses.map((s) => CODES[s]).join("");
}

export function decodeGridSnapshot(encoded: string): QuestionStatus[] {
  return encoded.split("").map((c) => DECODE[c] ?? "unanswered");
}
