/**
 * Migrates the legacy Electron app's question JSON (../../json/*.json) into
 * this project's schema and inserts it via Prisma.
 *
 * Usage:
 *   npx tsx scripts/migrate-json.ts                 # dry run: prints the mapping, writes nothing
 *   npx tsx scripts/migrate-json.ts --execute        # actually inserts into the database
 *   npx tsx scripts/migrate-json.ts --owner=you@example.com  # quiz creator (default: first user in DB)
 *
 * See MIGRATION-CALC-NOTES below (and the README) for the lossy conversions
 * this script makes: the old app's "calcul" questions call bespoke JS
 * functions (src/lib/simulateurs.js in the Electron project) with
 * interdependent/derived random variables, discrete flavor-text choices, and
 * (for delaiNotificationHausse) real calendar arithmetic. The new schema's
 * CALCUL type only supports independent uniform-random numeric variables fed
 * into a single mathjs formula, and DATE questions are static (no random
 * variables at all). Each of the 15 simulators below was hand-translated to
 * fit that shape as faithfully as possible — see the inline comments.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { quizImportSchema, type QuizImport } from "@/lib/schemas";

const JSON_DIR = path.join(__dirname, "..", "..", "json");

const EXECUTE = process.argv.includes("--execute");
const ownerArg = process.argv.find((a) => a.startsWith("--owner="));
const ownerEmail = ownerArg?.split("=")[1];

// ---------------------------------------------------------------------------
// Legacy question JSON shapes (subset of fields we actually read)
// ---------------------------------------------------------------------------
interface LegacyChoix {
  id: string;
  texte: string;
}
interface LegacyQuestion {
  id: string;
  question: string;
  section?: string;
  reponse_attendue?: string;
  qcm?: { choix: LegacyChoix[]; bonne_reponse?: string; bonnes_reponses?: string[] };
  calcul?: { simulateur: string };
}
interface LegacyFile {
  metadata?: { titre_source?: string; fichier_source?: string };
  questions: LegacyQuestion[];
}

function shortTitle(titreSource: string): string {
  const marker = "- extrait ";
  const idx = titreSource.indexOf(marker);
  return idx === -1 ? titreSource : titreSource.slice(idx + marker.length);
}

// ---------------------------------------------------------------------------
// CALCUL conversions — one entry per simulateur name referenced in the JSON.
// Ranges are chosen to avoid any cross-variable dependency (each variable is
// independently uniform-random) while still producing sensible, always-valid
// scenarios (e.g. "nouveau" ranges are kept strictly above "ancien" ranges
// wherever the original assumed an increase).
// ---------------------------------------------------------------------------
type CalcDef = QuizImport["themes"][number]["questions"][number] & { type: "CALCUL" };

export const CALC_CONVERSIONS: Record<string, CalcDef[]> = {
  ipc: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Dernière fixation du loyer : IPC connu de {ancien} pts. Calcul effectué aujourd'hui : IPC connu de {nouveau} pts. Sachant que seul 40% de la hausse de l'IPC peut être répercuté sur le loyer, quelle est la part de hausse répercutable (en %, arrondie à 0.01 près) ?",
        variables: [
          { nom: "ancien", min: 95, max: 99, unite: "pts", arrondi: 1 },
          { nom: "nouveau", min: 100.5, max: 108, unite: "pts", arrondi: 1 },
        ],
        formule: "(nouveau - ancien) / ancien * 100 * 0.4",
        unite_reponse: "%",
        arrondi_reponse: 2,
        tolerance: 0.1,
        explication:
          "Variation de l'IPC = (nouveau - ancien) / ancien × 100. Part répercutable = variation × 40%.",
      },
    },
  ],
  chargesExploitation: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Dernière fixation du loyer. Moyenne des charges d'exploitation et d'entretien des trois exercices précédant cette fixation : CHF {moyenne1}.-. Moyenne des charges des trois exercices précédant le calcul actuel : CHF {moyenne2}.-. Etat locatif annuel net de l'immeuble : CHF {etatLocatif}.-. Quel est le pourcentage de hausse à appliquer sur chaque loyer (arrondi à 0.01% près) ?",
        variables: [
          { nom: "etatLocatif", min: 120000, max: 220000, unite: "CHF", arrondi: 0 },
          { nom: "moyenne1", min: 18000, max: 30000, unite: "CHF", arrondi: 0 },
          { nom: "moyenne2", min: 31000, max: 48000, unite: "CHF", arrondi: 0 },
        ],
        formule: "(moyenne2 - moyenne1) * 100 / etatLocatif",
        unite_reponse: "%",
        arrondi_reponse: 2,
        tolerance: 0.1,
        explication: "Hausse = (moyenne2 - moyenne1) × 100 / état locatif.",
      },
    },
  ],
  fracheboud: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Un bailleur effectue des travaux à plus-value d'un immeuble pour un coût de CHF {cout}.-. La part de plus-value retenue est de {partPct}%, amortie sur {dureeAns} ans. Le taux hypothécaire de référence au moment du calcul est de {tauxHyp}%. Calculez le montant annuel total à répercuter sur les loyers selon la méthode Fracheboud (intérêt + amortissement + entretien à 1%), arrondi au franc.",
        variables: [
          { nom: "cout", min: 25000, max: 60000, unite: "CHF", arrondi: 0 },
          { nom: "partPct", min: 50, max: 75, unite: "%", arrondi: 0 },
          { nom: "dureeAns", min: 15, max: 30, unite: "ans", arrondi: 0 },
          { nom: "tauxHyp", min: 0.75, max: 2.25, unite: "%", arrondi: 2 },
        ],
        formule:
          "partPlusValue = cout * partPct / 100; interet = partPlusValue * ((tauxHyp + 2) / 2) / 100; amort = partPlusValue * (100 / dureeAns) / 100; entretien = partPlusValue / 100; interet + amort + entretien",
        unite_reponse: "CHF/an",
        arrondi_reponse: 0,
        tolerance: 10,
        explication:
          "Part de plus-value = coût × partPct%. Total = intérêts [(taux+2%)/2] + amortissement (100/durée) + entretien (1%), chacun appliqué à la part de plus-value.",
      },
    },
  ],
  // Direction (hausse/baisse) can't be a dynamic word in a static enonce
  // template, so the original single simulateur becomes two questions here.
  tauxHypothecaire: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Le taux hypothécaire de référence passe de {ancien}% à {nouveau}%. Quelle est la hausse de loyer net qui en résulte (en %, selon l'art. 13 OBLF) ?",
        variables: [
          { nom: "ancien", min: 0.5, max: 1.5, unite: "%", arrondi: 2 },
          { nom: "nouveau", min: 1.75, max: 3, unite: "%", arrondi: 2 },
        ],
        formule: "(nouveau - ancien) * 12",
        unite_reponse: "%",
        arrondi_reponse: 2,
        tolerance: 0.1,
        explication: "Chaque 0.25 point de hausse correspond à 3% de hausse de loyer, soit 12% par point entier.",
      },
    },
    {
      type: "CALCUL",
      content: {
        enonce:
          "Le taux hypothécaire de référence passe de {ancien}% à {nouveau}%. Quelle est la baisse de loyer net qui en résulte (en %, selon l'art. 13 OBLF) ?",
        variables: [
          { nom: "ancien", min: 2.75, max: 4, unite: "%", arrondi: 2 },
          { nom: "nouveau", min: 1.75, max: 2.5, unite: "%", arrondi: 2 },
        ],
        // Table de l'art. 13 OBLF (baisse), indexée par nombre de pas de 0.25 point.
        formule:
          "steps = round((ancien - nouveau) / 0.25); table = [2.91,5.66,8.26,10.71,13.04,15.25,17.36,19.35,21.26,23.08,24.81,26.47,28.06,29.58,31.03]; table[steps]",
        unite_reponse: "%",
        arrondi_reponse: 2,
        tolerance: 0.1,
        explication: "La baisse suit la table de l'art. 13 OBLF (non linéaire), selon le nombre de pas de 0.25 point.",
      },
    },
  ],
  rendementFondsPropres: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Un propriétaire a investi CHF {fondsPropres}.- de fonds propres dans son immeuble. Son revenu locatif annuel est de CHF {revenuLocatif}.-. Il paie CHF {interetsHyp}.- d'intérêts hypothécaires par année et ses charges d'exploitation et d'entretien s'élèvent à CHF {chargesExploitation}.-. Quel est le rendement de ses fonds propres (en %, arrondi à 0.01 près) ?",
        variables: [
          { nom: "fondsPropres", min: 250000, max: 500000, unite: "CHF", arrondi: 0 },
          { nom: "interetsHyp", min: 5000, max: 12000, unite: "CHF", arrondi: 0 },
          { nom: "chargesExploitation", min: 3000, max: 8000, unite: "CHF", arrondi: 0 },
          { nom: "revenuLocatif", min: 22000, max: 40000, unite: "CHF", arrondi: 0 },
        ],
        formule: "(revenuLocatif - (interetsHyp + chargesExploitation)) * 100 / fondsPropres",
        unite_reponse: "%",
        arrondi_reponse: 2,
        tolerance: 0.1,
        explication: "Rendement = (revenu locatif - intérêts hypothécaires - charges) × 100 / fonds propres.",
      },
    },
  ],
  rendementBrut: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Prix d'acquisition du terrain : CHF {prixAcquisition}.-. Droit de mutation et frais de notaire : CHF {fraisNotaire}.-. Coût de construction : CHF {coutConstruction}.-. Loyer annuel initial de CHF {loyerAnnuel}.-. Quel est le taux de rendement brut de cet objet (en %, arrondi à 0.01 près) ?",
        variables: [
          { nom: "prixAcquisition", min: 80000, max: 150000, unite: "CHF", arrondi: 0 },
          { nom: "fraisNotaire", min: 40, max: 80, unite: "CHF", arrondi: 0 },
          { nom: "coutConstruction", min: 400000, max: 550000, unite: "CHF", arrondi: 0 },
          { nom: "loyerAnnuel", min: 20000, max: 35000, unite: "CHF", arrondi: 0 },
        ],
        formule: "investissement = prixAcquisition + fraisNotaire + coutConstruction; loyerAnnuel * 100 / investissement",
        unite_reponse: "%",
        arrondi_reponse: 2,
        tolerance: 0.1,
        explication: "Taux de rendement brut = loyer annuel × 100 / (prix d'acquisition + frais de notaire + coût de construction).",
      },
    },
  ],
  indexation: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Loyer initial de CHF {loyerInitial}.-, fondé sur un IPC de {ancienIpc} pts. IPC connu au moment du calcul : {nouveauIpc} pts. Le loyer étant valablement indexé (100% de la variation de l'IPC), quel est le nouveau loyer, arrondi au franc ?",
        variables: [
          { nom: "loyerInitial", min: 9000, max: 22000, unite: "CHF", arrondi: 0 },
          { nom: "ancienIpc", min: 95, max: 100, unite: "pts", arrondi: 1 },
          { nom: "nouveauIpc", min: 102, max: 114, unite: "pts", arrondi: 1 },
        ],
        formule: "variation = (nouveauIpc - ancienIpc) / ancienIpc * 100; round(loyerInitial * (1 + variation / 100))",
        unite_reponse: "CHF",
        arrondi_reponse: 0,
        tolerance: 5,
        explication: "Nouveau loyer = loyer initial × (1 + variation de l'IPC).",
      },
    },
  ],
  reindexationFondsPropres: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Fonds propres investis à l'époque : CHF {fondsPropresInitiaux}.-. IPC connu à l'investissement : {ancienIpc} pts. IPC connu au jour du calcul : {nouveauIpc} pts. Quel est le montant des fonds propres réindexés à retenir pour le calcul de rendement, arrondi au franc ?",
        variables: [
          { nom: "fondsPropresInitiaux", min: 150000, max: 900000, unite: "CHF", arrondi: 0 },
          { nom: "ancienIpc", min: 95, max: 100, unite: "pts", arrondi: 1 },
          { nom: "nouveauIpc", min: 103, max: 117, unite: "pts", arrondi: 1 },
        ],
        formule: "variation = (nouveauIpc - ancienIpc) / ancienIpc * 100; round(fondsPropresInitiaux * (1 + variation / 100))",
        unite_reponse: "CHF",
        arrondi_reponse: 0,
        // The original used a tolerance proportional to magnitude (roughly
        // half of the 3rd significant figure); the new schema only supports
        // a flat tolerance, so this is a compromise across the 150k-900k range.
        tolerance: 300,
        explication: "Fonds propres réindexés = fonds propres initiaux × (1 + variation de l'IPC).",
      },
    },
  ],
  chargesEntretienExtraordinaire: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Remplacement d'un équipement pour un montant de CHF {cout}.-, amorti sur {dureeAns} ans. Le taux hypothécaire de référence est de {tauxHyp}%. Quel est le montant annuel total (amortissement + intérêts) à ajouter aux charges d'exploitation et d'entretien, arrondi au franc ?",
        variables: [
          { nom: "cout", min: 20000, max: 55000, unite: "CHF", arrondi: 0 },
          { nom: "dureeAns", min: 15, max: 25, unite: "ans", arrondi: 0 },
          { nom: "tauxHyp", min: 0.75, max: 2, unite: "%", arrondi: 2 },
        ],
        formule: "amort = cout * (100 / dureeAns) / 100; interet = cout * ((tauxHyp + 2) / 2) / 100; amort + interet",
        unite_reponse: "CHF",
        arrondi_reponse: 0,
        tolerance: 10,
        explication: "Total = amortissement (coût × 100/durée) + intérêts (coût × [(taux+2%)/2]).",
      },
    },
  ],
  // Original had 3 discrete building-size categories (each with its own
  // fraction and flavor text); fixed here to the "4-8 family house" case
  // (fraction = 1/2) since the schema can't pick discrete categories.
  chauffageLogementVacant: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Un immeuble de {nombreAppartements} appartements (maison de quatre à huit familles) comporte un logement resté vacant durant toute la période de chauffe, chauffé uniquement pour prévenir les dégâts dus au gel, sans compteur de chaleur. Le total des frais de chauffage de l'exercice pour l'ensemble de l'immeuble s'élève à CHF {totalChauffage}.-. Quel montant le bailleur doit-il prendre à sa charge pour ce logement vacant (en CHF, arrondi au franc) ?",
        variables: [
          { nom: "nombreAppartements", min: 4, max: 8, unite: "", arrondi: 0 },
          { nom: "totalChauffage", min: 3000, max: 9000, unite: "CHF", arrondi: 0 },
        ],
        formule: "partAppartement = totalChauffage / nombreAppartements; round(partAppartement * 0.5)",
        unite_reponse: "CHF",
        arrondi_reponse: 0,
        tolerance: 3,
        explication: "Part théorique = total / nombre d'appartements. Pour une maison de 4 à 8 familles, le bailleur prend la moitié à sa charge.",
      },
    },
  ],
  decouplageFraisAccessoires: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Un contrat de bail prévoit un loyer mensuel net de CHF {ancienLoyerNet}.-, les frais accessoires étant jusque-là compris dans ce loyer net. Le bailleur notifie une formule officielle afin de facturer désormais séparément un montant de CHF {montantSepare}.- de frais accessoires. Pour que l'opération reste économiquement neutre, quel doit être le nouveau loyer mensuel net (en CHF) ?",
        variables: [
          { nom: "ancienLoyerNet", min: 14000, max: 26000, unite: "CHF", arrondi: 0 },
          { nom: "montantSepare", min: 500, max: 2500, unite: "CHF", arrondi: 0 },
        ],
        formule: "ancienLoyerNet - montantSepare",
        unite_reponse: "CHF",
        arrondi_reponse: 0,
        tolerance: 1,
        explication: "Nouveau loyer net = ancien loyer net - montant désormais facturé séparément.",
      },
    },
  ],
  cpeMontantFacturable: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Un bailleur a conclu un contrat de performance énergétique (CPE). Le coût annuel du contrat s'élève à CHF {coutAnnuelCPE}.-. Les économies de coûts énergétiques effectivement réalisées durant la période de décompte s'élèvent à CHF {economiesRealisees}.-. Quel est le montant maximal que le bailleur peut facturer aux locataires au titre de frais accessoires pour cette période (en CHF) ?",
        variables: [
          { nom: "coutAnnuelCPE", min: 800, max: 3000, unite: "CHF", arrondi: 0 },
          { nom: "economiesRealisees", min: 800, max: 3000, unite: "CHF", arrondi: 0 },
        ],
        formule: "min(coutAnnuelCPE, economiesRealisees)",
        unite_reponse: "CHF",
        arrondi_reponse: 0,
        tolerance: 1,
        explication: "Le montant facturable ne peut dépasser les économies effectivement réalisées.",
      },
    },
  ],
  reductionLoyer: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Loyer mensuel net de CHF {loyerNet}.-. Une réduction de loyer de {pct}% est octroyée au locataire en raison d'un défaut, pour une durée de {dureeJours} jours. Quel est le montant de la réduction (en CHF, arrondi au franc) ?",
        variables: [
          { nom: "loyerNet", min: 900, max: 2600, unite: "CHF", arrondi: 0 },
          { nom: "pct", min: 5, max: 50, unite: "%", arrondi: 0 },
          { nom: "dureeJours", min: 3, max: 28, unite: "jours", arrondi: 0 },
        ],
        formule: "reductionMensuelle = loyerNet * pct / 100; round((reductionMensuelle / 30) * dureeJours)",
        unite_reponse: "CHF",
        arrondi_reponse: 0,
        tolerance: 3,
        explication: "Réduction mensuelle = loyer × pourcentage. Réduction pour la période = (réduction mensuelle / 30) × nombre de jours.",
      },
    },
  ],
  // Original had 5 discrete installation types (each with its own duree);
  // fixed here to "parquet" (20 ans / 240 mois) for the same reason as above.
  amortissementDegats: [
    {
      type: "CALCUL",
      content: {
        enonce:
          "Le parquet a été posé il y a {elapsedMonths} mois (durée de vie usuelle : 20 ans, soit 240 mois). Il est endommagé par le locataire lors de la restitution des locaux. La facture de réparation s'élève à CHF {facture}.-. Quel montant est à la charge du locataire (en CHF, arrondi au franc), compte tenu de l'amortissement usuel ?",
        variables: [
          { nom: "elapsedMonths", min: 12, max: 234, unite: "mois", arrondi: 0 },
          { nom: "facture", min: 1500, max: 9000, unite: "CHF", arrondi: 0 },
        ],
        formule: "amortPct = elapsedMonths * 100 / 240; locatairePct = 100 - amortPct; round(facture * locatairePct / 100)",
        unite_reponse: "CHF",
        arrondi_reponse: 0,
        tolerance: 5,
        explication: "Part locataire (%) = 100% - (mois écoulés / 240 × 100%). Montant dû = facture × part locataire.",
      },
    },
  ],
};

// delaiNotificationHausse: real calendar arithmetic (month-length-aware date
// subtraction), not expressible as a mathjs numeric formula, and the new
// DATE question type has no random-variable support at all. Fixed here to
// one of the original's 8 possible scenarios (échéance 31 mars, préavis 3
// mois) rather than dropped — flagged in the migration summary below.
const DATE_CONVERSIONS: Record<string, QuizImport["themes"][number]["questions"][number][]> = {
  delaiNotificationHausse: [
    {
      type: "DATE",
      content: {
        enonce:
          "Un bail a son échéance fixée au 31 mars de chaque année, avec un préavis de résiliation de 3 mois. En tenant compte d'un délai de garde postal de 10 jours à respecter en plus du délai légal de 10 jours, à quelle date au plus tard le bailleur doit-il envoyer la hausse de loyer au locataire ? (Indiquez le jour et le mois ; l'année choisie ci-dessous n'a pas d'incidence sur la règle.)",
        reponse_correcte: "2025-12-11",
        tolerance_jours: 0,
        explication:
          "3 mois avant le 31 mars amène au 31 décembre ; en reculant de 10 jours (délai légal), la date limite de réception par le locataire est le 21 décembre. En reculant encore de 10 jours (délai de garde postal), le bailleur doit envoyer le pli au plus tard le 11 décembre.",
      },
    },
  ],
};

// ---------------------------------------------------------------------------

function mapLegacyQuestion(q: LegacyQuestion): QuizImport["themes"][number]["questions"] {
  if (q.qcm?.bonnes_reponses) {
    const ids = new Set(q.qcm.bonnes_reponses);
    const correctTextes = q.qcm.choix.filter((c) => ids.has(c.id)).map((c) => c.texte);
    if (correctTextes.length !== q.qcm.bonnes_reponses.length) {
      throw new Error(`Question ${q.id}: certains ids de bonnes_reponses introuvables dans choix.`);
    }
    return [
      {
        type: "QCM_MULTIPLE",
        section: q.section,
        content: {
          enonce: q.question,
          propositions: q.qcm.choix.map((c) => c.texte),
          reponses_correctes: correctTextes,
          explication: q.reponse_attendue,
        },
      },
    ];
  }

  if (q.qcm?.bonne_reponse) {
    const correct = q.qcm.choix.find((c) => c.id === q.qcm!.bonne_reponse);
    if (!correct) throw new Error(`Question ${q.id}: bonne_reponse "${q.qcm.bonne_reponse}" introuvable dans choix.`);
    return [
      {
        type: "QCM_SIMPLE",
        section: q.section,
        content: {
          enonce: q.question,
          propositions: q.qcm.choix.map((c) => c.texte),
          reponse_correcte: correct.texte,
          explication: q.reponse_attendue,
        },
      },
    ];
  }

  if (q.calcul) {
    const name = q.calcul.simulateur;
    const calc = CALC_CONVERSIONS[name];
    if (calc) return calc.map((entry) => ({ ...entry, section: q.section }));
    const date = DATE_CONVERSIONS[name];
    if (date) return date.map((entry) => ({ ...entry, section: q.section }));
    throw new Error(`Question ${q.id}: simulateur "${name}" sans conversion connue.`);
  }

  throw new Error(`Question ${q.id}: ni qcm ni calcul (ne devrait pas arriver après filtrage).`);
}

const QUIZ_TITLE = "Droit du bail";

async function main() {
  const files = fs
    .readdirSync(JSON_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const chapters: QuizImport["themes"] = [];
  let totalQuestionsIn = 0;
  let totalQuestionsOut = 0;
  const skipped: { file: string; questionId: string; reason: string }[] = [];

  for (const file of files) {
    const raw: LegacyFile = JSON.parse(fs.readFileSync(path.join(JSON_DIR, file), "utf-8"));
    const title = shortTitle(raw.metadata?.titre_source ?? file);

    const outQuestions: QuizImport["themes"][number]["questions"] = [];
    for (const q of raw.questions) {
      const isQcmWithChoices = q.qcm && Array.isArray(q.qcm.choix) && q.qcm.choix.length > 0;
      if (!isQcmWithChoices && !q.calcul) continue; // same filter as chapters.js
      totalQuestionsIn++;
      try {
        outQuestions.push(...mapLegacyQuestion(q));
      } catch (err) {
        skipped.push({ file, questionId: q.id, reason: (err as Error).message });
      }
    }
    totalQuestionsOut += outQuestions.length;

    if (outQuestions.length === 0) continue;

    chapters.push({ title, description: `Importé depuis ${file}`, questions: outQuestions });
  }

  const quiz: QuizImport = {
    title: QUIZ_TITLE,
    description: "Quiz de révision sur le droit du bail (importé depuis l'app locale).",
    status: "PRIVATE",
    themes: chapters,
  };

  // Validate against the same zod schema the /api/import route uses.
  const result = quizImportSchema.safeParse(quiz);
  if (!result.success) {
    console.error(`Validation échouée pour "${quiz.title}":`, result.error.flatten());
    process.exitCode = 1;
    return;
  }

  console.log(`Fichiers source : ${files.length}`);
  console.log(`Questions lues (qcm/calcul) : ${totalQuestionsIn}`);
  console.log(`Questions générées (après conversion) : ${totalQuestionsOut}`);
  console.log(`Quiz à créer : 1 ("${quiz.title}"), ${chapters.length} chapitres`);
  if (skipped.length > 0) {
    console.log(`\nQuestions ignorées (${skipped.length}) :`);
    for (const s of skipped) console.log(`  - [${s.file}] ${s.questionId}: ${s.reason}`);
  }
  console.log("\nDétail par chapitre :");
  for (const chapter of chapters) {
    const counts = chapter.questions.reduce<Record<string, number>>((acc, q) => {
      acc[q.type] = (acc[q.type] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`  - ${chapter.title}: ${JSON.stringify(counts)}`);
  }

  if (!EXECUTE) {
    console.log("\nDry run (par défaut) : rien n'a été écrit en base. Relancez avec --execute pour importer.");
    return;
  }

  const owner = ownerEmail
    ? await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } })
    : await prisma.user.findFirstOrThrow();

  await prisma.$transaction(async (tx) => {
    const createdQuiz = await tx.quiz.create({
      data: { title: quiz.title, description: quiz.description, status: quiz.status, creatorId: owner.id },
    });
    for (const [order, themeInput] of quiz.themes.entries()) {
      const theme = await tx.theme.create({ data: { title: themeInput.title, description: themeInput.description } });
      await tx.quizTheme.create({ data: { quizId: createdQuiz.id, themeId: theme.id, order } });
      await tx.question.createMany({
        data: themeInput.questions.map((q) => ({ themeId: theme.id, type: q.type, content: q.content, section: q.section })),
      });
    }
  });

  console.log(`\nQuiz "${quiz.title}" importé (${chapters.length} chapitres) pour l'utilisateur ${owner.email}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
