"use client";

import { useEffect, useRef, useState } from "react";

function expandPercent(expr: string): string {
  const pattern = /(-?\d+(?:\.\d+)?)%(-?\d+(?:\.\d+)?)/;
  let result = expr;
  while (pattern.test(result)) {
    result = result.replace(pattern, (_, a, b) => `(${a}/${b}*100)`);
  }
  return result;
}

function safeEval(expr: string): number | null {
  const normalized = expr.replace(/,/g, ".").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  const cleaned = expandPercent(normalized);
  if (!/^[0-9+\-*/().\s]*$/.test(cleaned)) return null;
  try {
    const fn = new Function(`"use strict"; return (${cleaned || "0"})`);
    const result = fn();
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Wraps each number in a clickable/hoverable <span>, preserves line breaks.
function renderNoteHtml(text: string): string {
  const escaped = escapeHtml(text).replace(/\n/g, "<br>");
  return escaped.replace(/-?\d+(?:[.,]\d+)?/g, (m) => `<span class="qz-note-number">${m}</span>`);
}

function getCaretOffset(root: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().length;
}

function setCaretOffset(root: HTMLElement, offset: number) {
  const range = document.createRange();
  const sel = window.getSelection();
  if (!sel) return;
  let remaining = offset;
  let placed = false;
  function walk(node: Node) {
    if (placed) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) {
        range.setStart(node, Math.max(0, remaining));
        range.collapse(true);
        placed = true;
      } else {
        remaining -= length;
      }
      return;
    }
    for (const child of Array.from(node.childNodes)) {
      walk(child);
      if (placed) return;
    }
  }
  walk(root);
  if (!placed) {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

const OPERATORS = ["+", "−", "×", "÷", "%"];

const PAD: { key: string; cls?: string }[] = [
  { key: "C", cls: "qz-calc-key-clear" },
  { key: "⌫", cls: "qz-calc-key-clear" },
  { key: "%", cls: "qz-calc-key-percent" },
  { key: "=", cls: "qz-calc-key-equals" },
  { key: "7" }, { key: "8" }, { key: "9" }, { key: "÷", cls: "qz-calc-key-op" },
  { key: "4" }, { key: "5" }, { key: "6" }, { key: "×", cls: "qz-calc-key-op" },
  { key: "1" }, { key: "2" }, { key: "3" }, { key: "−", cls: "qz-calc-key-op" },
  { key: "0", cls: "qz-calc-key-zero" }, { key: "." }, { key: "+", cls: "qz-calc-key-op" },
];

export default function Calculator() {
  const [expr, setExpr] = useState("");
  const [note, setNote] = useState("");
  const noteRef = useRef<HTMLDivElement>(null);
  const skipNextRender = useRef(false);

  const result = expr.trim() === "" ? null : safeEval(expr);
  const displayResult = result === null ? null : Math.round(result * 10000) / 10000;

  useEffect(() => {
    if (!noteRef.current) return;
    if (skipNextRender.current) {
      skipNextRender.current = false;
      return;
    }
    noteRef.current.innerHTML = renderNoteHtml(note);
  }, [note]);

  function pressKey(key: string) {
    if (key === "C") {
      setExpr("");
      return;
    }
    if (key === "⌫") {
      setExpr((e) => e.slice(0, -1));
      return;
    }
    if (key === "=") {
      if (result !== null) setExpr(String(Math.round(result * 1e8) / 1e8));
      return;
    }
    if (OPERATORS.includes(key)) {
      setExpr((e) => (OPERATORS.includes(e.slice(-1)) ? e.slice(0, -1) + key : e + key));
      return;
    }
    setExpr((e) => e + key);
  }

  function sendResultToNote() {
    if (displayResult === null) return;
    setNote((n) => (n ? n + "\n" : "") + `${displayResult}`);
    setExpr("");
  }

  function handleNoteInput(e: React.FormEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const offset = getCaretOffset(el);
    const text = (el.innerText ?? "").replace(/\n$/, "");
    skipNextRender.current = true;
    setNote(text);
    requestAnimationFrame(() => {
      if (noteRef.current) setCaretOffset(noteRef.current, offset);
    });
  }

  function handleNoteClick(e: React.MouseEvent<HTMLDivElement>) {
    const span = (e.target as HTMLElement).closest(".qz-note-number");
    if (span) {
      const value = (span.textContent ?? "").replace(/,/g, ".");
      setExpr((ex) => ex + value);
    }
  }

  return (
    <div className="qz-calculatrice">
      <div className="qz-calculatrice-panel">
        <div className="qz-calculatrice-display">
          <input
            type="text"
            className="qz-calculatrice-input"
            placeholder="0"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
          />
          <span className="qz-calculatrice-result">
            {expr.trim() === "" ? "" : displayResult === null ? "?" : displayResult}
          </span>
        </div>

        <div className="qz-calculatrice-toolbar">
          <button type="button" className="qz-calc-tool-key" onClick={() => pressKey("(")}>
            (
          </button>
          <button type="button" className="qz-calc-tool-key" onClick={() => pressKey(")")}>
            )
          </button>
          <button
            type="button"
            className="qz-calc-tool-key qz-calc-tool-send"
            disabled={displayResult === null}
            title="Envoyer le résultat dans le bloc-notes"
            onClick={sendResultToNote}
          >
            📖↓
          </button>
        </div>

        <div className="qz-calculatrice-pad">
          {PAD.map(({ key, cls }, i) => (
            <button type="button" key={i} className={`qz-calc-key ${cls || ""}`} onClick={() => pressKey(key)}>
              {key}
            </button>
          ))}
        </div>

        <div
          ref={noteRef}
          className="qz-calculatrice-notes"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Bloc-notes (brouillon de calcul)… cliquez un nombre pour le renvoyer dans la calculatrice"
          onInput={handleNoteInput}
          onClick={handleNoteClick}
        />
      </div>
    </div>
  );
}
