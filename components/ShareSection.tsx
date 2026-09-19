"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type GuestLink = { id: string; token: string; guestName: string | null };

export default function ShareSection({ quizId, initialLinks }: { quizId: string; initialLinks: GuestLink[] }) {
  const [links, setLinks] = useState(initialLinks);
  const [newGuestName, setNewGuestName] = useState("");
  const [qrByLink, setQrByLink] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<{ id: string; what: "link" | "key" } | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    let cancelled = false;
    for (const link of links) {
      if (qrByLink[link.token] || !origin) continue;
      QRCode.toDataURL(`${origin}/share/${link.token}`, { width: 200, margin: 1 }).then((url) => {
        if (!cancelled) setQrByLink((prev) => ({ ...prev, [link.token]: url }));
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, origin]);

  async function addLink() {
    setCreating(true);
    const res = await fetch(`/api/quizzes/${quizId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestName: newGuestName.trim() || null }),
    });
    const data: { link: GuestLink } = await res.json();
    setLinks((prev) => [...prev, data.link]);
    setNewGuestName("");
    setCreating(false);
  }

  async function regenerate(linkId: string) {
    setBusyId(linkId);
    const res = await fetch(`/api/quizzes/${quizId}/share/${linkId}`, { method: "PUT" });
    const data: { link: GuestLink } = await res.json();
    setLinks((prev) => prev.map((l) => (l.id === linkId ? data.link : l)));
    setQrByLink((prev) => {
      const next = { ...prev };
      delete next[data.link.token];
      return next;
    });
    setBusyId(null);
  }

  async function revoke(linkId: string) {
    setBusyId(linkId);
    await fetch(`/api/quizzes/${quizId}/share/${linkId}`, { method: "DELETE" });
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    setBusyId(null);
  }

  function copy(value: string, id: string, what: "link" | "key") {
    navigator.clipboard.writeText(value);
    setCopied({ id, what });
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mt-10 rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="font-medium">Partager ce quiz</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Donne accès au quiz à une ou plusieurs personnes extérieures, sans compte, via un lien, un QR code ou une clé
        d&apos;accès. Chaque lien est indépendant : en révoquer ou en régénérer un n&apos;affecte pas les autres.
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-zinc-500">Prénom de la personne (optionnel)</label>
          <input
            type="text"
            value={newGuestName}
            onChange={(e) => setNewGuestName(e.target.value)}
            placeholder="Ex: Marie"
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={addLink}
          disabled={creating}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Générer un lien de partage
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {links.map((link) => {
          const shareUrl = origin ? `${origin}/share/${link.token}` : "";
          const busy = busyId === link.id;
          return (
            <div key={link.id} className="flex flex-col gap-4 rounded border border-zinc-200 p-3 sm:flex-row sm:items-start">
              {qrByLink[link.token] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrByLink[link.token]}
                  alt="QR code d'accès au quiz"
                  className="h-32 w-32 rounded border border-zinc-200"
                />
              )}
              <div className="flex flex-1 flex-col gap-3">
                {link.guestName && <p className="text-sm text-zinc-700">Lien pour <span className="font-medium">{link.guestName}</span></p>}
                <div>
                  <label className="text-xs font-medium text-zinc-500">Lien</label>
                  <div className="mt-1 flex gap-2">
                    <input readOnly value={shareUrl} className="flex-1 truncate rounded border border-zinc-300 px-2 py-1 text-xs" />
                    <button
                      type="button"
                      onClick={() => copy(shareUrl, link.id, "link")}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                    >
                      {copied?.id === link.id && copied.what === "link" ? "Copié !" : "Copier"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500">Clé d&apos;accès</label>
                  <div className="mt-1 flex gap-2">
                    <input readOnly value={link.token} className="flex-1 truncate rounded border border-zinc-300 px-2 py-1 text-xs" />
                    <button
                      type="button"
                      onClick={() => copy(link.token, link.id, "key")}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                    >
                      {copied?.id === link.id && copied.what === "key" ? "Copié !" : "Copier"}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => regenerate(link.id)}
                    disabled={busy}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Régénérer
                  </button>
                  <button
                    type="button"
                    onClick={() => revoke(link.id)}
                    disabled={busy}
                    className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Révoquer
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
