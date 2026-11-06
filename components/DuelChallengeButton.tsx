"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Step = "closed" | "choose" | "waiting" | "ended";

// "Défier" button of a leaderboard row: picks the format (BO1/3/5), sends
// the invite, then shows a waiting popup that polls the duel until the
// opponent answers — accepted sends both players to the duel screen.
export default function DuelChallengeButton({ token, opponentId, opponentName }: { token: string; opponentId: string; opponentName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [duelId, setDuelId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function send(bestOf: number) {
    setSending(true);
    const res = await fetch(`/api/share/${token}/duels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opponentId, bestOf }),
    });
    setSending(false);
    if (!res.ok) {
      setMessage((await res.json()).error ?? "Impossible d'envoyer le défi.");
      setStep("ended");
      return;
    }
    setDuelId((await res.json()).id);
    setStep("waiting");
  }

  useEffect(() => {
    if (step !== "waiting" || !duelId) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/share/${token}/duels/${duelId}`);
      if (!res.ok) return;
      const { status } = await res.json();
      if (status === "ACTIVE") router.push(`/share/${token}/duel/${duelId}`);
      else if (status === "DECLINED") {
        setMessage(`${opponentName} a refuse le defi.`);
        setStep("ended");
      } else if (status === "CANCELLED") {
        setMessage(`${opponentName} n'a pas repondu a temps.`);
        setStep("ended");
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [step, duelId, token, opponentName, router]);

  async function cancel() {
    if (duelId) {
      await fetch(`/api/share/${token}/duels/${duelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
    }
    setStep("closed");
  }

  return (
    <>
      <button type="button" className="qz-duel-challenge-btn" onClick={() => setStep("choose")}>
        Defier
      </button>

      {step !== "closed" && (
        <div className="qz-question-grid-modal-backdrop">
          <div className="qz-question-grid-modal qz-duel-modal">
            {step === "choose" && (
              <>
                <button type="button" className="qz-question-grid-modal-close" onClick={() => setStep("closed")} aria-label="Fermer">
                  ✕
                </button>
                <p className="qz-duel-modal-title">⚔️ Defier {opponentName}</p>
                <p className="qz-question-grid-modal-answer">Combien de manches ? Chaque manche se joue sur 10 questions d&apos;un chapitre.</p>
                <div className="qz-duel-bo-row">
                  {[1, 3, 5].map((n) => (
                    <button key={n} type="button" className="qz-btn-primary" disabled={sending} onClick={() => send(n)}>
                      BO {n}
                    </button>
                  ))}
                </div>
              </>
            )}
            {step === "waiting" && (
              <>
                <div className="qz-duel-spinner" />
                <p className="qz-duel-modal-title">En attente de {opponentName}...</p>
                <p className="qz-question-grid-modal-answer">Le defi lui a ete envoye. Il a 2 minutes pour l&apos;accepter.</p>
                <button type="button" className="qz-btn-secondary" onClick={cancel}>
                  Annuler le defi
                </button>
              </>
            )}
            {step === "ended" && (
              <>
                <p className="qz-duel-modal-title">{message}</p>
                <button type="button" className="qz-btn-primary" onClick={() => setStep("closed")}>
                  OK
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
