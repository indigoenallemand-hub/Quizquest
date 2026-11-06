"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Inbox {
  invite: { id: string; bestOf: number; from: string } | null;
  active: { id: string; against: string } | null;
}

// Mounted on the guest's main menu: polls for duel invites addressed to this
// guest (popup to accept/decline) and for a duel already under way (offer to
// resume it, e.g. after leaving the duel screen).
export default function DuelInbox({ token }: { token: string }) {
  const router = useRouter();
  const [inbox, setInbox] = useState<Inbox>({ invite: null, active: null });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      const res = await fetch(`/api/share/${token}/duels`);
      if (res.ok && !stopped) setInbox(await res.json());
    }
    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [token]);

  async function answer(duelId: string, action: "accept" | "decline") {
    setBusy(true);
    const res = await fetch(`/api/share/${token}/duels/${duelId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    setDismissed(duelId);
    if (action === "accept" && res.ok && (await res.json()).status === "ACTIVE") router.push(`/share/${token}/duel/${duelId}`);
  }

  const invite = inbox.invite && inbox.invite.id !== dismissed ? inbox.invite : null;

  return (
    <>
      {inbox.active && !invite && (
        <div className="qz-duel-banner">
          <span>⚔️ Duel en cours contre {inbox.active.against}</span>
          <button type="button" className="qz-duel-challenge-btn" onClick={() => router.push(`/share/${token}/duel/${inbox.active!.id}`)}>
            Reprendre
          </button>
        </div>
      )}

      {invite && (
        <div className="qz-question-grid-modal-backdrop">
          <div className="qz-question-grid-modal qz-duel-modal">
            <p className="qz-duel-modal-title">⚔️ {invite.from} vous defie !</p>
            <p className="qz-question-grid-modal-answer">
              Duel en BO {invite.bestOf} : {invite.bestOf} manche{invite.bestOf > 1 ? "s" : ""} de 10 questions en 5 minutes, chaque joueur choisit le chapitre a tour de role.
            </p>
            <div className="qz-duel-bo-row">
              <button type="button" className="qz-btn-primary" disabled={busy} onClick={() => answer(invite.id, "accept")}>
                Accepter
              </button>
              <button type="button" className="qz-btn-secondary" disabled={busy} onClick={() => answer(invite.id, "decline")}>
                Refuser
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
