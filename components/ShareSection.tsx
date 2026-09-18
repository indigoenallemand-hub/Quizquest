"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function ShareSection({ quizId, initialShareToken }: { quizId: string; initialShareToken: string | null }) {
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"link" | "key" | null>(null);

  const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/share/${shareToken}` : null;

  useEffect(() => {
    if (!shareUrl) return;
    let cancelled = false;
    QRCode.toDataURL(shareUrl, { width: 200, margin: 1 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  async function generate() {
    setBusy(true);
    setQrDataUrl(null);
    const res = await fetch(`/api/quizzes/${quizId}/share`, { method: "POST" });
    const data: { shareToken: string } = await res.json();
    setShareToken(data.shareToken);
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    await fetch(`/api/quizzes/${quizId}/share`, { method: "DELETE" });
    setShareToken(null);
    setQrDataUrl(null);
    setBusy(false);
  }

  function copy(value: string, what: "link" | "key") {
    navigator.clipboard.writeText(value);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mt-10 rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="font-medium">Partager ce quiz</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Donne accès au quiz à une personne extérieure, sans compte, via un lien, un QR code ou une clé d&apos;accès.
        Régénérer le lien révoque l&apos;ancien : la personne qui l&apos;avait devra en obtenir un nouveau.
      </p>

      {!shareToken ? (
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="mt-3 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Générer un lien de partage
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR code d'accès au quiz" className="h-32 w-32 rounded border border-zinc-200" />
          )}
          <div className="flex flex-1 flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500">Lien</label>
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  value={shareUrl ?? ""}
                  className="flex-1 truncate rounded border border-zinc-300 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => shareUrl && copy(shareUrl, "link")}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                >
                  {copied === "link" ? "Copié !" : "Copier"}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Clé d&apos;accès</label>
              <div className="mt-1 flex gap-2">
                <input readOnly value={shareToken} className="flex-1 truncate rounded border border-zinc-300 px-2 py-1 text-xs" />
                <button
                  type="button"
                  onClick={() => copy(shareToken, "key")}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                >
                  {copied === "key" ? "Copié !" : "Copier"}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
              >
                Régénérer
              </button>
              <button
                type="button"
                onClick={disable}
                disabled={busy}
                className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Désactiver le partage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
