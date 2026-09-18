import { evaluate, isResultSet } from "mathjs";
import type { CalculContent } from "@/lib/schemas";

export type GeneratedVariables = Record<string, number>;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function randomInRange(min: number, max: number, decimals: number): number {
  const raw = min + Math.random() * (max - min);
  return round(raw, decimals);
}

// Server-side only: never send the formula's expected answer to the client
// before it submits, and never let the client supply its own variables.
export function generateVariables(content: CalculContent): GeneratedVariables {
  const variables: GeneratedVariables = {};
  for (const v of content.variables) {
    variables[v.nom] = randomInRange(v.min, v.max, v.arrondi);
  }
  return variables;
}

// mathjs's `evaluate` runs in its own sandboxed expression language — it has
// no access to Node/browser globals, the filesystem, or arbitrary JS, unlike
// a native eval(). That's why the formule field is safe to store as free text.
// A formule can be a single expression or several `;`-separated statements
// (intermediate variables, then a final expression) — mathjs then returns a
// ResultSet whose last entry is the one we care about.
export function evaluateFormula(content: CalculContent, variables: GeneratedVariables): number {
  let result = evaluate(content.formule, variables);
  if (isResultSet(result)) {
    result = result.entries[result.entries.length - 1];
  }
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error(`La formule "${content.formule}" n'a pas produit un nombre valide.`);
  }
  return round(result, content.arrondi_reponse);
}

export function renderEnonce(enonce: string, variables: GeneratedVariables, content: CalculContent): string {
  return enonce.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in variables)) return match;
    const varDef = content.variables.find((v) => v.nom === name);
    const value = variables[name];
    return varDef?.unite ? `${value} ${varDef.unite}` : String(value);
  });
}

export function isCalcAnswerCorrect(content: CalculContent, expected: number, answerGiven: number): boolean {
  return Math.abs(answerGiven - expected) <= content.tolerance;
}
