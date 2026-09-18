"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormType = "QCM_SIMPLE" | "QCM_MULTIPLE" | "DATE" | "CALCUL";

interface VariableRow {
  nom: string;
  min: string;
  max: string;
  unite: string;
  arrondi: string;
}

interface InitialValues {
  questionId: string;
  type: FormType;
  section: string;
  enonce: string;
  explication: string;
  propositions: string[];
  correctIndex: number | null;
  correctIndexes: number[];
  dateCorrect: string;
  toleranceJours: string;
  variables: VariableRow[];
  formule: string;
  uniteReponse: string;
  arrondiReponse: string;
  tolerance: string;
}

const EMPTY_VALUES: Omit<InitialValues, "questionId"> = {
  type: "QCM_SIMPLE",
  section: "",
  enonce: "",
  explication: "",
  propositions: ["", ""],
  correctIndex: null,
  correctIndexes: [],
  dateCorrect: "",
  toleranceJours: "0",
  variables: [{ nom: "", min: "", max: "", unite: "", arrondi: "0" }],
  formule: "",
  uniteReponse: "",
  arrondiReponse: "2",
  tolerance: "0.01",
};

const TYPE_LABELS: Record<FormType, string> = {
  QCM_SIMPLE: "QCM (une seule bonne reponse)",
  QCM_MULTIPLE: "QCM (plusieurs bonnes reponses)",
  DATE: "Date",
  CALCUL: "Calcul",
};

export default function QuestionEditForm({
  themeId,
  backHref,
  initial,
}: {
  themeId: string;
  backHref: string;
  initial?: InitialValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Omit<InitialValues, "questionId">>(initial ?? EMPTY_VALUES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function addProposition() {
    update("propositions", [...values.propositions, ""]);
  }

  function updateProposition(index: number, text: string) {
    const next = [...values.propositions];
    next[index] = text;
    update("propositions", next);
  }

  function removeProposition(index: number) {
    const next = values.propositions.filter((_, i) => i !== index);
    update("propositions", next);
    if (values.correctIndex === index) update("correctIndex", null);
    else if (values.correctIndex !== null && values.correctIndex > index) update("correctIndex", values.correctIndex - 1);
    update(
      "correctIndexes",
      values.correctIndexes.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i))
    );
  }

  function toggleCorrectIndex(index: number) {
    update(
      "correctIndexes",
      values.correctIndexes.includes(index) ? values.correctIndexes.filter((i) => i !== index) : [...values.correctIndexes, index]
    );
  }

  function addVariable() {
    update("variables", [...values.variables, { nom: "", min: "", max: "", unite: "", arrondi: "0" }]);
  }

  function updateVariable(index: number, field: keyof VariableRow, text: string) {
    const next = values.variables.map((v, i) => (i === index ? { ...v, [field]: text } : v));
    update("variables", next);
  }

  function removeVariable(index: number) {
    update(
      "variables",
      values.variables.filter((_, i) => i !== index)
    );
  }

  function buildPayload(): { type: FormType; section?: string; content: Record<string, unknown> } | null {
    const section = values.section.trim() || undefined;

    if (values.type === "QCM_SIMPLE") {
      const propositions = values.propositions.map((p) => p.trim()).filter(Boolean);
      const correct = values.correctIndex !== null ? values.propositions[values.correctIndex]?.trim() : undefined;
      if (propositions.length < 2 || !correct) {
        setError("Au moins 2 propositions et une bonne reponse selectionnee sont requises.");
        return null;
      }
      return {
        type: "QCM_SIMPLE",
        section,
        content: { enonce: values.enonce, propositions, reponse_correcte: correct, explication: values.explication || undefined },
      };
    }

    if (values.type === "QCM_MULTIPLE") {
      const propositions = values.propositions.map((p) => p.trim()).filter(Boolean);
      const correctes = values.correctIndexes.map((i) => values.propositions[i]?.trim()).filter(Boolean) as string[];
      if (propositions.length < 2 || correctes.length === 0) {
        setError("Au moins 2 propositions et au moins une bonne reponse cochee sont requises.");
        return null;
      }
      return {
        type: "QCM_MULTIPLE",
        section,
        content: { enonce: values.enonce, propositions, reponses_correctes: correctes, explication: values.explication || undefined },
      };
    }

    if (values.type === "DATE") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(values.dateCorrect)) {
        setError("La date de reponse doit etre renseignee.");
        return null;
      }
      return {
        type: "DATE",
        section,
        content: {
          enonce: values.enonce,
          reponse_correcte: values.dateCorrect,
          tolerance_jours: Number(values.toleranceJours) || 0,
          explication: values.explication || undefined,
        },
      };
    }

    // CALCUL
    const variables = values.variables
      .filter((v) => v.nom.trim())
      .map((v) => ({
        nom: v.nom.trim(),
        min: Number(v.min),
        max: Number(v.max),
        unite: v.unite.trim() || undefined,
        arrondi: Number(v.arrondi) || 0,
      }));
    if (variables.length === 0 || !values.formule.trim()) {
      setError("Au moins une variable et une formule sont requises.");
      return null;
    }
    return {
      type: "CALCUL",
      section,
      content: {
        enonce: values.enonce,
        variables,
        formule: values.formule.trim(),
        unite_reponse: values.uniteReponse.trim() || undefined,
        arrondi_reponse: Number(values.arrondiReponse) || 0,
        tolerance: Number(values.tolerance) || 0.01,
        explication: values.explication || undefined,
      },
    };
  }

  async function handleSubmit() {
    setError(null);
    const payload = buildPayload();
    if (!payload) return;

    setSaving(true);
    const url = initial ? `/api/questions/${initial.questionId}` : "/api/questions";
    const method = initial ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initial ? payload : { ...payload, themeId }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Erreur lors de l'enregistrement.");
      return;
    }
    router.push(backHref);
    router.refresh();
  }

  return (
    <div className="qz-start-card" style={{ maxWidth: "100%" }}>
      <div className="qz-form-group">
        <label htmlFor="type">Type de question</label>
        <select
          id="type"
          className="qz-select"
          value={values.type}
          onChange={(e) => update("type", e.target.value as FormType)}
          disabled={!!initial}
        >
          {(Object.keys(TYPE_LABELS) as FormType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="qz-form-group">
        <label htmlFor="enonce">Enonce</label>
        <textarea
          id="enonce"
          className="qz-calc-input"
          rows={3}
          value={values.enonce}
          onChange={(e) => update("enonce", e.target.value)}
        />
      </div>

      <div className="qz-form-group">
        <label htmlFor="section">Section (optionnel)</label>
        <input id="section" className="qz-calc-input" value={values.section} onChange={(e) => update("section", e.target.value)} />
      </div>

      {(values.type === "QCM_SIMPLE" || values.type === "QCM_MULTIPLE") && (
        <div className="qz-form-group">
          <label>Propositions {values.type === "QCM_SIMPLE" ? "(cocher la bonne reponse)" : "(cocher les bonnes reponses)"}</label>
          {values.propositions.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {values.type === "QCM_SIMPLE" ? (
                <input type="radio" name="correct" checked={values.correctIndex === i} onChange={() => update("correctIndex", i)} />
              ) : (
                <input type="checkbox" checked={values.correctIndexes.includes(i)} onChange={() => toggleCorrectIndex(i)} />
              )}
              <input
                className="qz-calc-input"
                style={{ flex: 1 }}
                value={p}
                onChange={(e) => updateProposition(i, e.target.value)}
              />
              <button type="button" className="qz-btn-quit" onClick={() => removeProposition(i)}>
                Retirer
              </button>
            </div>
          ))}
          <button type="button" className="qz-btn-secondary" onClick={addProposition}>
            + Ajouter une proposition
          </button>
        </div>
      )}

      {values.type === "DATE" && (
        <>
          <div className="qz-form-group">
            <label htmlFor="dateCorrect">Bonne reponse</label>
            <input
              id="dateCorrect"
              type="date"
              className="qz-calc-input"
              value={values.dateCorrect}
              onChange={(e) => update("dateCorrect", e.target.value)}
            />
          </div>
          <div className="qz-form-group">
            <label htmlFor="toleranceJours">Tolerance (jours)</label>
            <input
              id="toleranceJours"
              type="number"
              className="qz-calc-input"
              value={values.toleranceJours}
              onChange={(e) => update("toleranceJours", e.target.value)}
            />
          </div>
        </>
      )}

      {values.type === "CALCUL" && (
        <>
          <div className="qz-form-group">
            <label>Variables (utilisees dans la formule)</label>
            {values.variables.map((v, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <input
                  className="qz-calc-input"
                  placeholder="nom"
                  style={{ width: "100px" }}
                  value={v.nom}
                  onChange={(e) => updateVariable(i, "nom", e.target.value)}
                />
                <input
                  className="qz-calc-input"
                  placeholder="min"
                  type="number"
                  style={{ width: "90px" }}
                  value={v.min}
                  onChange={(e) => updateVariable(i, "min", e.target.value)}
                />
                <input
                  className="qz-calc-input"
                  placeholder="max"
                  type="number"
                  style={{ width: "90px" }}
                  value={v.max}
                  onChange={(e) => updateVariable(i, "max", e.target.value)}
                />
                <input
                  className="qz-calc-input"
                  placeholder="unite"
                  style={{ width: "80px" }}
                  value={v.unite}
                  onChange={(e) => updateVariable(i, "unite", e.target.value)}
                />
                <input
                  className="qz-calc-input"
                  placeholder="arrondi"
                  type="number"
                  style={{ width: "80px" }}
                  value={v.arrondi}
                  onChange={(e) => updateVariable(i, "arrondi", e.target.value)}
                />
                <button type="button" className="qz-btn-quit" onClick={() => removeVariable(i)}>
                  Retirer
                </button>
              </div>
            ))}
            <button type="button" className="qz-btn-secondary" onClick={addVariable}>
              + Ajouter une variable
            </button>
          </div>

          <div className="qz-form-group">
            <label htmlFor="formule">Formule (expression mathjs, ex: a + b * 2)</label>
            <input id="formule" className="qz-calc-input" value={values.formule} onChange={(e) => update("formule", e.target.value)} />
          </div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div className="qz-form-group" style={{ width: "auto" }}>
              <label htmlFor="uniteReponse">Unite de reponse</label>
              <input
                id="uniteReponse"
                className="qz-calc-input"
                value={values.uniteReponse}
                onChange={(e) => update("uniteReponse", e.target.value)}
              />
            </div>
            <div className="qz-form-group" style={{ width: "auto" }}>
              <label htmlFor="arrondiReponse">Arrondi</label>
              <input
                id="arrondiReponse"
                type="number"
                className="qz-calc-input"
                value={values.arrondiReponse}
                onChange={(e) => update("arrondiReponse", e.target.value)}
              />
            </div>
            <div className="qz-form-group" style={{ width: "auto" }}>
              <label htmlFor="tolerance">Tolerance</label>
              <input
                id="tolerance"
                type="number"
                step="any"
                className="qz-calc-input"
                value={values.tolerance}
                onChange={(e) => update("tolerance", e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      <div className="qz-form-group">
        <label htmlFor="explication">Explication (optionnel)</label>
        <textarea
          id="explication"
          className="qz-calc-input"
          rows={2}
          value={values.explication}
          onChange={(e) => update("explication", e.target.value)}
        />
      </div>

      {error && <p style={{ color: "var(--qz-error)" }}>{error}</p>}

      <button type="button" className="qz-btn-primary" onClick={handleSubmit} disabled={saving}>
        {saving ? "Enregistrement..." : initial ? "Enregistrer les modifications" : "Creer la question"}
      </button>
    </div>
  );
}
