// "LE TEST": a timed mock exam drawn from every enabled chapter of a quiz
// (level-2 chapters included), weighted by subject group.

export const EXAM_QUESTION_COUNT = 280;
export const EXAM_DURATION_MS = 3 * 60 * 60 * 1000;

// Swiss grade: correct / total × 5 + 1, from 1 (nothing right) to 6 (all right).
export function swissGrade(correct: number, total: number): number {
  if (total <= 0) return 1;
  return (correct / total) * 5 + 1;
}

interface ExamGroup {
  key: string;
  label: string;
  // Share of the exam; groups with no question are dropped and the
  // remaining weights are rescaled.
  weight: number;
  matches: (title: string) => boolean;
}

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Matched in order: the first group whose rule matches a chapter title wins.
// A level-2 chapter is classified by its parent's title.
const GROUPS: ExamGroup[] = [
  {
    key: "bail",
    label: "Droit du bail",
    weight: 1 / 3,
    matches: (t) => /\bbail\b|etat des lieux|frais accessoires|decompte de chauffage/.test(normalize(t)),
  },
  {
    key: "ppe",
    label: "Administration PPE",
    weight: 1 / 6,
    matches: (t) => /\bppe\b|propriete par etages/.test(normalize(t)),
  },
  {
    key: "gerance-technique",
    label: "Gérance technique",
    weight: 1 / 6,
    matches: (t) => /gerance technique/.test(normalize(t)),
  },
];
const OTHER_WEIGHT = 1 / 3;

export interface ExamChapter<Q> {
  themeId: string;
  title: string;
  parentThemeId: string | null;
  questions: Q[];
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Splits `total` across buckets proportionally to `weights`, never giving a
// bucket more than its `capacity`; what a full bucket can't take goes to the
// others (largest-remainder rounding).
function allocate(total: number, weights: number[], capacities: number[]): number[] {
  const result = weights.map(() => 0);
  let remaining = Math.min(total, capacities.reduce((s, c) => s + c, 0));
  let open = weights.map((w, i) => (w > 0 && capacities[i] > 0 ? i : -1)).filter((i) => i !== -1);

  while (remaining > 0 && open.length > 0) {
    const weightSum = open.reduce((s, i) => s + weights[i], 0);
    const ideal = open.map((i) => (remaining * weights[i]) / weightSum);
    const floors = ideal.map(Math.floor);
    let leftover = remaining - floors.reduce((s, f) => s + f, 0);
    const order = ideal.map((v, k) => ({ k, frac: v - floors[k] })).sort((a, b) => b.frac - a.frac);
    for (const { k } of order) {
      if (leftover <= 0) break;
      floors[k]++;
      leftover--;
    }
    let given = 0;
    open.forEach((i, k) => {
      const take = Math.min(floors[k], capacities[i] - result[i]);
      result[i] += take;
      given += take;
    });
    remaining -= given;
    if (given === 0) break;
    // Buckets that hit their capacity drop out; the next pass spreads what
    // they couldn't take over the others.
    open = open.filter((i) => result[i] < capacities[i]);
  }
  return result;
}

// Draws the exam's questions. Within a named group every question has the
// same chance; the "other" chapters each get a share proportional to their
// size.
export function drawExamQuestions<Q>(chapters: ExamChapter<Q>[], count = EXAM_QUESTION_COUNT): Q[] {
  const titleById = new Map(chapters.map((c) => [c.themeId, c.title]));
  const buckets: { weight: number; pool: Q[] }[] = GROUPS.map((g) => ({ weight: g.weight, pool: [] as Q[] }));
  const others: Q[][] = [];

  for (const chapter of chapters) {
    if (chapter.questions.length === 0) continue;
    const title = (chapter.parentThemeId && titleById.get(chapter.parentThemeId)) || chapter.title;
    const groupIndex = GROUPS.findIndex((g) => g.matches(title) || g.matches(chapter.title));
    if (groupIndex === -1) others.push(chapter.questions);
    else buckets[groupIndex].pool.push(...chapter.questions);
  }

  const otherTotal = others.reduce((s, qs) => s + qs.length, 0);
  for (const pool of others) buckets.push({ weight: (OTHER_WEIGHT * pool.length) / otherTotal, pool });

  const counts = allocate(
    count,
    buckets.map((b) => (b.pool.length > 0 ? b.weight : 0)),
    buckets.map((b) => b.pool.length)
  );
  return shuffle(buckets.flatMap((b, i) => shuffle(b.pool).slice(0, counts[i])));
}
