"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuizSession from "@/components/QuizSession";
import type { DuelState } from "@/lib/duel";

const TERMINAL = ["FINISHED", "ABANDONED", "DECLINED", "CANCELLED"];
const BACK_TO_MENU_SECONDS = 10;

// Both players' view of a duel, kept in sync by polling the duel state.
// Per round: the chooser picks a chapter, both play the same questions
// through QuizSession, then the round result is shown until acknowledged.
export default function DuelScreen({ token, duelId }: { token: string; duelId: string }) {
  const router = useRouter();
  const menuHref = `/share/${token}/play`;
  const [state, setState] = useState<DuelState | null>(null);
  const [error, setError] = useState("");
  // Last round whose QuizSession reported the series done. Until then the
  // round stays on QuizSession, so the last answer's feedback isn't cut off
  // by a poll (a reload after finishing just flashes an empty session).
  const [doneRound, setDoneRound] = useState<number | null>(null);
  // Number of finished rounds whose result screen was already dismissed.
  const [seen, setSeen] = useState<number | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [countdown, setCountdown] = useState(BACK_TO_MENU_SECONDS);
  // Time of the last poll, used to show the opponent's remaining round time.
  const [polledAt, setPolledAt] = useState(0);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/share/${token}/duels/${duelId}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Duel introuvable.");
      return;
    }
    setState(data);
    setPolledAt(Date.now());
    setSeen((s) => s ?? (data as DuelState).rounds.filter((r) => r.finished).length);
  }, [token, duelId]);

  const terminal = !!state && TERMINAL.includes(state.status);
  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = terminal ? undefined : setInterval(refresh, 2000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh, terminal]);

  const current = state?.rounds[state.rounds.length - 1];
  const finishedCount = state?.rounds.filter((r) => r.finished).length ?? 0;
  const unseenRound = seen !== null && finishedCount > seen ? state!.rounds.filter((r) => r.finished)[seen] : null;

  const showFinal = terminal && !unseenRound;
  useEffect(() => {
    if (!showFinal) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [showFinal]);
  useEffect(() => {
    if (showFinal && countdown <= 0) router.push(menuHref);
  }, [showFinal, countdown, router, menuHref]);

  async function act(body: object) {
    const res = await fetch(`/api/share/${token}/duels/${duelId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) setState(await res.json());
  }

  if (error) {
    return (
      <div className="qz-quiz-screen px-6 py-10">
        <div className="qz-result-card">
          <p className="qz-result-message">{error}</p>
          <Link href={menuHref} className="qz-btn-primary">
            Retour au menu
          </Link>
        </div>
      </div>
    );
  }
  if (!state || seen === null) return <div className="qz-quiz-screen px-6 py-10">Chargement...</div>;

  const secondsUntil = (iso: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - polledAt) / 1000)) : 0);

  const scoreboard = (
    <div className="qz-duel-scoreboard">
      <div className="qz-duel-player">
        <span className="qz-duel-player-name">{state.me.name} (vous)</span>
        <span className="qz-duel-player-score">{state.score.me}</span>
      </div>
      <div className="qz-duel-vs">
        <span>VS</span>
        <span className="qz-duel-round-label">
          BO {state.bestOf}
          {state.status === "ACTIVE" && current ? ` · manche ${current.index + 1}/${state.bestOf}` : ""}
        </span>
      </div>
      <div className="qz-duel-player">
        <span className="qz-duel-player-name">{state.opponent.name}</span>
        <span className="qz-duel-player-score">{state.score.opponent}</span>
      </div>
    </div>
  );

  if (unseenRound) {
    const won = unseenRound.myErrors! < unseenRound.opponentErrors!;
    const lost = unseenRound.myErrors! > unseenRound.opponentErrors!;
    const isLast = unseenRound.index + 1 >= state.bestOf || terminal;
    return (
      <div className="qz-quiz-screen px-6 py-10">
        {scoreboard}
        <div className="qz-result-card">
          <div className="qz-result-emoji">{won ? "🎯" : lost ? "😬" : "🤝"}</div>
          <h1 className="qz-result-title">Manche {unseenRound.index + 1} terminee</h1>
          <p className="qz-result-message">{unseenRound.themeTitle}</p>
          <div className="qz-result-stats">
            <div className="qz-stat qz-stat-correct">
              <span className="qz-stat-value">{unseenRound.myErrors}</span>
              <span className="qz-stat-label">Vos fautes</span>
            </div>
            <div className="qz-stat qz-stat-wrong">
              <span className="qz-stat-value">{unseenRound.opponentErrors}</span>
              <span className="qz-stat-label">Fautes de {state.opponent.name}</span>
            </div>
          </div>
          <p className="qz-result-message">
            {won ? "Vous gagnez le point !" : lost ? `${state.opponent.name} gagne le point.` : "Egalite : vous marquez tous les deux le point."}
          </p>
          <button type="button" className="qz-btn-primary" onClick={() => setSeen(seen + 1)}>
            {isLast ? "Voir le resultat final" : "Manche suivante"}
          </button>
        </div>
      </div>
    );
  }

  if (showFinal) {
    const headline =
      state.status === "DECLINED"
        ? { emoji: "🙅", text: `${state.opponent.name} a refuse le defi.` }
        : state.status === "CANCELLED"
          ? { emoji: "⌛", text: "Ce defi n'a pas eu lieu." }
          : state.status === "ABANDONED"
            ? state.outcome === "win"
              ? { emoji: "🏆", text: `${state.opponent.name} a abandonne : vous remportez le duel !` }
              : { emoji: "🏳️", text: `Vous avez abandonne. Bravo a ${state.opponent.name} !` }
            : state.outcome === "win"
              ? { emoji: "🏆", text: `Felicitations ${state.me.name}, vous remportez le duel !` }
              : state.outcome === "loss"
                ? { emoji: "🏆", text: `Felicitations a ${state.opponent.name}, qui remporte le duel !` }
                : { emoji: "🤝", text: "Egalite parfaite ! Bravo a tous les deux." };
    return (
      <div className="qz-quiz-screen px-6 py-10">
        {(state.status === "FINISHED" || state.status === "ABANDONED") && scoreboard}
        <div className="qz-result-card">
          <div className="qz-result-emoji qz-duel-trophy">{headline.emoji}</div>
          <h1 className="qz-result-title">{headline.text}</h1>
          <p className="qz-result-message">Retour au menu dans {Math.max(countdown, 0)} s...</p>
          <Link href={menuHref} className="qz-btn-primary">
            Retour au menu
          </Link>
        </div>
      </div>
    );
  }

  const abandon = (
    <div className="qz-duel-abandon">
      {confirmAbandon ? (
        <>
          <span>Abandonner le duel ?</span>
          <button type="button" className="qz-btn-quit" onClick={() => act({ action: "abandon" })}>
            Oui, abandonner
          </button>
          <button type="button" className="qz-btn-quit" onClick={() => setConfirmAbandon(false)}>
            Non
          </button>
        </>
      ) : (
        <button type="button" className="qz-btn-quit" onClick={() => setConfirmAbandon(true)}>
          Abandonner
        </button>
      )}
    </div>
  );

  if (state.status === "PENDING" || !current) {
    return (
      <div className="qz-quiz-screen px-6 py-10">
        {scoreboard}
        <div className="qz-result-card">
          <div className="qz-duel-spinner" />
          <p className="qz-result-message">En attente de {state.opponent.name}...</p>
        </div>
      </div>
    );
  }

  if (current.themeId && doneRound !== current.index) {
    return (
      <div className="qz-duel-playing">
        <p className="qz-duel-round-banner">
          Manche {current.index + 1}/{state.bestOf} · {current.themeTitle} · {state.opponent.name} : {current.opponentAnswered}/{current.total}
        </p>
        <QuizSession
          key={current.index}
          mode="QCM"
          questionsUrl={`/api/share/${token}/duels/${duelId}/questions`}
          attemptsUrl={`/api/share/${token}/duels/${duelId}/answers`}
          backHref={menuHref}
          allowComment={false}
          deadline={current.deadline ? new Date(current.deadline).getTime() : undefined}
          onComplete={() => {
            setDoneRound(current.index);
            refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="qz-quiz-screen px-6 py-10">
      {scoreboard}
      {!current.themeId && current.iChoose ? (
        <div className="qz-result-card">
          <h1 className="qz-result-title">A vous de choisir le chapitre</h1>
          <p className="qz-result-message">Vous jouerez tous les deux les memes 10 questions de ce chapitre, en 5 minutes.</p>
          <p className="qz-question-grid-modal-answer">Sans choix, un chapitre sera tire au hasard dans {secondsUntil(current.chooseDeadline)} s.</p>
          <div className="qz-duel-theme-list">
            {state.themes.map((t) => (
              <button key={t.id} type="button" className="qz-choice" onClick={() => act({ action: "choose", themeId: t.id })}>
                <span className="qz-choice-text">{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="qz-result-card">
          <div className="qz-duel-spinner" />
          <p className="qz-result-message">
            {!current.themeId
              ? `${state.opponent.name} choisit le chapitre de la manche ${current.index + 1}...`
              : `Vous avez termine la manche. ${state.opponent.name} en est a ${current.opponentAnswered}/${current.total} questions...`}
          </p>
          <p className="qz-question-grid-modal-answer">
            {current.themeId ? `Temps restant : ${secondsUntil(current.deadline)} s` : `Choix automatique dans ${secondsUntil(current.chooseDeadline)} s`}
          </p>
        </div>
      )}
      {abandon}
    </div>
  );
}
