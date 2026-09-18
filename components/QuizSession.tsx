"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Calculator from "@/components/Calculator";

const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Mode = "ENTRAINEMENT" | "QCM" | "REPONSE_LIBRE";

type PublicQuestion =
  | { id: string; type: "QCM_SIMPLE"; section: string | null; enonce: string; propositions: string[]; themeId?: string }
  | { id: string; type: "QCM_MULTIPLE"; section: string | null; enonce: string; propositions: string[]; themeId?: string }
  | { id: string; type: "DATE"; section: string | null; enonce: string; themeId?: string }
  | {
      id: string;
      type: "CALCUL";
      section: string | null;
      enonce: string;
      variables: Record<string, number>;
      uniteReponse: string | null;
      arrondiReponse: number;
      themeId?: string;
    };

type ThemeBlock = { id: string; title: string; questions: PublicQuestion[] };

interface AttemptResult {
  isCorrect: boolean;
  feedback?: string;
  correctAnswerText?: string;
  correctChoices?: string[];
  newlyEarnedBadges?: string[];
  error?: string;
}

interface AnsweredRecord {
  question: string;
  selectedText: string;
  correctText: string;
  isCorrect: boolean;
}

export default function QuizSession({
  mode,
  questionsUrl,
  attemptsUrl,
  backHref,
  section,
  count,
  quizId,
}: {
  mode: Mode;
  questionsUrl: string;
  attemptsUrl: string;
  backHref: string;
  section?: string;
  count?: number;
  quizId?: string;
}) {
  const [sessionId] = useState(() => (mode === "ENTRAINEMENT" ? undefined : crypto.randomUUID()));
  const [questions, setQuestions] = useState<PublicQuestion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [answers, setAnswers] = useState<AnsweredRecord[]>([]);
  const [showReview, setShowReview] = useState(false);

  const [selectedSingle, setSelectedSingle] = useState("");
  const [selectedMultiple, setSelectedMultiple] = useState<string[]>([]);
  const [dateValue, setDateValue] = useState("");
  const [numberValue, setNumberValue] = useState("");
  const [freeText, setFreeText] = useState("");

  useEffect(() => {
    fetch(questionsUrl)
      .then((res) => res.json())
      .then((data: { themes: ThemeBlock[] }) => {
        let pool = data.themes.flatMap((t) => t.questions);
        if (section && section !== "all") pool = pool.filter((q) => q.section === section);
        pool = shuffleArray(pool);
        if (count) pool = pool.slice(0, count);
        setQuestions(pool);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionsUrl]);

  const current = questions?.[index];

  // Shuffled + lettered (A/B/C...) choices for the current question. Stable
  // while the question is on screen (same order pre- and post-answer),
  // reshuffled whenever a new question comes up.
  const shuffledChoices = useMemo(() => {
    if (!current || (current.type !== "QCM_SIMPLE" && current.type !== "QCM_MULTIPLE")) return [];
    return shuffleArray(current.propositions).map((text, i) => ({ text, label: LABELS[i] ?? String(i + 1) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  function resetAnswerState() {
    setSelectedSingle("");
    setSelectedMultiple([]);
    setDateValue("");
    setNumberValue("");
    setFreeText("");
    setResult(null);
  }

  async function submitAnswer(answer: unknown, selectedText: string) {
    if (!current || submitting) return;
    setSubmitting(true);

    const body =
      mode === "REPONSE_LIBRE"
        ? {
            questionId: current.id,
            mode,
            sessionId,
            text: freeText,
            answer: current.type === "CALCUL" ? { variables: current.variables } : undefined,
          }
        : { questionId: current.id, mode, sessionId, answer };

    const res = await fetch(attemptsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: AttemptResult = await res.json();
    setSubmitting(false);
    setResult(data);
    if (data.isCorrect) setScore((s) => s + 1);
    if (data.newlyEarnedBadges?.length) {
      setEarnedBadges((prev) => [...prev, ...data.newlyEarnedBadges!]);
    }
    setAnswers((prev) => [
      ...prev,
      {
        question: current.enonce,
        selectedText,
        correctText: data.correctAnswerText ?? "",
        isCorrect: data.isCorrect,
      },
    ]);
  }

  function selectSingle(proposition: string) {
    if (result) return;
    setSelectedSingle(proposition);
    submitAnswer({ selected: proposition }, proposition);
  }

  function toggleMultiple(proposition: string) {
    if (result) return;
    setSelectedMultiple((prev) => (prev.includes(proposition) ? prev.filter((p) => p !== proposition) : [...prev, proposition]));
  }

  function submitMultiple() {
    if (selectedMultiple.length === 0) return;
    submitAnswer({ selected: selectedMultiple }, selectedMultiple.join(" ; "));
  }

  function submitDate() {
    if (!dateValue) return;
    submitAnswer({ date: dateValue }, dateValue);
  }

  function submitCalc() {
    if (current?.type !== "CALCUL" || numberValue.trim() === "") return;
    const unite = current.uniteReponse ? current.uniteReponse : "";
    submitAnswer({ value: Number(numberValue), variables: current.variables }, `${numberValue}${unite}`);
  }

  function submitFreeText() {
    if (freeText.trim() === "") return;
    submitAnswer(undefined, freeText);
  }

  function next() {
    resetAnswerState();
    setIndex((i) => i + 1);
  }

  if (loading) return <div className="qz-quiz-screen px-6 py-10">Chargement...</div>;
  if (!questions || questions.length === 0) {
    return <div className="qz-quiz-screen px-6 py-10">Aucune question disponible.</div>;
  }

  if (index >= questions.length) {
    const total = questions.length;
    const percentage = Math.round((score / total) * 100);
    const wrongAnswers = answers.filter((a) => !a.isCorrect);
    const resultMessage =
      percentage >= 90
        ? { emoji: "🏆", text: "Excellent ! Maitrise parfaite." }
        : percentage >= 75
          ? { emoji: "🎯", text: "Tres bien ! Quelques points a revoir." }
          : percentage >= 60
            ? { emoji: "📖", text: "Bien ! Continuez a vous entrainer." }
            : percentage >= 40
              ? { emoji: "💪", text: "En progres. Revisez les mauvaises reponses." }
              : { emoji: "📝", text: "A retravailler. Ne vous decouragez pas !" };
    const scoreColor = percentage >= 75 ? "var(--qz-success)" : percentage >= 50 ? "var(--qz-warning)" : "var(--qz-error)";

    return (
      <div className="qz-quiz-screen px-6 py-10">
        <div className="qz-result-card">
          <div className="qz-result-emoji">{resultMessage.emoji}</div>
          <h1 className="qz-result-title">{mode === "ENTRAINEMENT" ? "Entrainement termine !" : "Test termine !"}</h1>

          <div className="qz-score-display" style={{ color: scoreColor }}>
            <span className="qz-score-fraction">
              {score} / {total}
            </span>
            <span className="qz-score-percent">{percentage}%</span>
          </div>

          <p className="qz-result-message">{resultMessage.text}</p>

          {earnedBadges.length > 0 && (
            <p style={{ color: "var(--qz-success)", fontWeight: 600 }}>
              Nouveau(x) badge(s) debloque(s) : {earnedBadges.join(", ")}
            </p>
          )}

          <div className="qz-result-progress">
            <div className="qz-result-progress-fill" style={{ width: `${percentage}%`, background: scoreColor }} />
          </div>

          <div className="qz-result-stats">
            <div className="qz-stat qz-stat-correct">
              <span className="qz-stat-value">{score}</span>
              <span className="qz-stat-label">Bonnes reponses</span>
            </div>
            <div className="qz-stat qz-stat-wrong">
              <span className="qz-stat-value">{total - score}</span>
              <span className="qz-stat-label">Mauvaises reponses</span>
            </div>
          </div>

          {wrongAnswers.length > 0 && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <button type="button" className="qz-btn-secondary" onClick={() => setShowReview((v) => !v)}>
                {showReview ? "Masquer" : "Revoir"} les {wrongAnswers.length} mauvaises reponses
              </button>
              {showReview && (
                <div className="qz-review-list">
                  {wrongAnswers.map((a, i) => (
                    <div key={i} className="qz-review-item">
                      <p className="qz-review-question">
                        {i + 1}. {a.question}
                      </p>
                      <p className="qz-review-wrong">Reponse donnee : {a.selectedText || "(pas de reponse)"}</p>
                      <p className="qz-review-correct">Bonne reponse : {a.correctText}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <Link href={backHref} className="qz-btn-primary">
            Retour au quiz
          </Link>
        </div>
      </div>
    );
  }

  const q = current!;
  const progressPct = ((result ? index + 1 : index) / questions.length) * 100;

  return (
    <div className="qz-quiz-screen px-6 py-10">
      <div className="qz-quiz-header">
        <div className="qz-progress-info">
          <span className="qz-question-counter">
            Question {index + 1} / {questions.length}
          </span>
          <div className="qz-header-right">
            <span className="qz-score-pill">Score : {score}</span>
            <Link href={backHref} className="qz-btn-quit">
              Quitter
            </Link>
          </div>
        </div>
        <div className="qz-progress-bar">
          <div className="qz-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="qz-question-card">
        <p className="qz-question-text">{q.enonce}</p>
        {quizId && q.themeId && (
          <Link
            href={`/quizzes/${quizId}/edit/${q.themeId}/${q.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="qz-question-edit-link"
            title="Modifier cette question"
          >
            ✏️
          </Link>
        )}
      </div>

      {!result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {mode === "REPONSE_LIBRE" ? (
            <>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                rows={5}
                className="qz-calc-input"
                placeholder="Redigez votre reponse..."
              />
              <button type="button" className="qz-btn-primary qz-btn-valider" onClick={submitFreeText} disabled={submitting}>
                {submitting ? "Envoi..." : "Valider"}
              </button>
            </>
          ) : q.type === "QCM_SIMPLE" ? (
            <div className="qz-choices">
              {shuffledChoices.map(({ text, label }) => (
                <button
                  key={text}
                  type="button"
                  className={`qz-choice ${selectedSingle === text ? "is-selected" : ""}`}
                  onClick={() => selectSingle(text)}
                  disabled={submitting}
                >
                  <span className="qz-choice-id">{label}</span>
                  <span className="qz-choice-text">{text}</span>
                </button>
              ))}
            </div>
          ) : q.type === "QCM_MULTIPLE" ? (
            <div className="qz-choices">
              {shuffledChoices.map(({ text }) => (
                <button
                  key={text}
                  type="button"
                  className={`qz-choice ${selectedMultiple.includes(text) ? "is-selected" : ""}`}
                  onClick={() => toggleMultiple(text)}
                >
                  <span className="qz-choice-id">{selectedMultiple.includes(text) ? "☑" : "☐"}</span>
                  <span className="qz-choice-text">{text}</span>
                </button>
              ))}
              <button
                type="button"
                className="qz-btn-primary qz-btn-valider"
                disabled={selectedMultiple.length === 0 || submitting}
                onClick={submitMultiple}
              >
                Valider ({selectedMultiple.length} selectionnee{selectedMultiple.length > 1 ? "s" : ""})
              </button>
            </div>
          ) : q.type === "DATE" ? (
            <>
              <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} className="qz-calc-input" />
              <button type="button" className="qz-btn-primary qz-btn-valider" disabled={!dateValue || submitting} onClick={submitDate}>
                Valider
              </button>
            </>
          ) : (
            <div className="qz-calc-block">
              <div className="qz-calc-input-row">
                <input
                  type="number"
                  step="any"
                  value={numberValue}
                  onChange={(e) => setNumberValue(e.target.value)}
                  placeholder="Votre reponse"
                  className="qz-calc-input"
                  disabled={submitting}
                />
                <span className="qz-calc-unit">{q.uniteReponse}</span>
              </div>
              <button
                type="button"
                className="qz-btn-primary qz-btn-valider"
                disabled={numberValue.trim() === "" || submitting}
                onClick={submitCalc}
              >
                Valider
              </button>
              <Calculator />
            </div>
          )}
        </div>
      )}

      {result && (
        <>
          {q.type === "QCM_SIMPLE" && (
            <div className="qz-choices">
              {shuffledChoices.map(({ text, label }) => {
                const isCorrectChoice = (result.correctChoices ?? []).includes(text);
                const wasSelected = selectedSingle === text;
                const cls = isCorrectChoice && wasSelected
                  ? "is-correct"
                  : isCorrectChoice
                    ? "is-missed"
                    : wasSelected
                      ? "is-wrong"
                      : "is-faded";
                return (
                  <div key={text} className={`qz-choice ${cls}`}>
                    <span className="qz-choice-id">{label}</span>
                    <span className="qz-choice-text">{text}</span>
                  </div>
                );
              })}
            </div>
          )}

          {q.type === "QCM_MULTIPLE" && (
            <div className="qz-choices">
              {shuffledChoices.map(({ text, label }) => {
                const isCorrectChoice = (result.correctChoices ?? []).includes(text);
                const wasSelected = selectedMultiple.includes(text);
                const cls = isCorrectChoice && wasSelected
                  ? "is-correct"
                  : isCorrectChoice
                    ? "is-missed"
                    : wasSelected
                      ? "is-wrong"
                      : "is-faded";
                const marker = isCorrectChoice && wasSelected ? "✓" : isCorrectChoice ? "!" : wasSelected ? "✗" : label;
                return (
                  <div key={text} className={`qz-choice ${cls}`}>
                    <span className="qz-choice-id">{marker}</span>
                    <span className="qz-choice-text">{text}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className={`qz-feedback ${result.isCorrect ? "qz-feedback-correct" : "qz-feedback-wrong"}`}>
            {result.isCorrect
              ? "Bonne reponse !"
              : `Mauvaise reponse${result.correctAnswerText ? ` -- La bonne reponse : ${result.correctAnswerText}` : ""}`}
          </div>

          {result.feedback && (
            <div className="qz-calc-explanation">{result.feedback}</div>
          )}

          <div className="qz-quiz-footer">
            <button type="button" onClick={next} className="qz-btn-primary qz-btn-next">
              {index + 1 >= questions.length ? "Voir les resultats" : "Question suivante"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
