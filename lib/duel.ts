import { prisma } from "@/lib/prisma";
import { readGuestAccess } from "@/lib/guest-access";
import { getPublicView } from "@/lib/question-resolver";
import type { DuelStatus } from "@/lib/generated/prisma/enums";

export const DUEL_BEST_OF = [1, 3, 5] as const;
export const DUEL_QUESTIONS_PER_ROUND = 10;
// Time each player has to answer a round's questions once the chapter is
// picked. Unanswered questions when time runs out count as mistakes.
export const DUEL_ROUND_SECONDS = 5 * 60;
// Leeway for an answer sent just before the deadline but received after it.
const DUEL_ANSWER_GRACE_MS = 5000;
// The player whose turn it is to pick a chapter gets this long; after that a
// random chapter is drawn, so an absent chooser can't block the duel.
export const DUEL_CHOOSE_SECONDS = 60;

// Protections, applied by cleanupDuels():
// - an ACTIVE duel neither player has had open for DUEL_IDLE_MS is deleted;
// - an ACTIVE duel started more than DUEL_MAX_MS ago is deleted (a full BO5
//   takes at most 5 x (1 + 5) = 30 minutes);
// - ended, declined, expired or never-answered duels are purged after DUEL_PURGE_MS.
const DUEL_IDLE_MS = 2 * 60 * 1000;
const DUEL_MAX_MS = 45 * 60 * 1000;
const DUEL_PURGE_MS = 24 * 60 * 60 * 1000;
// Presence timestamps are only rewritten when older than this, so 2-second
// polling doesn't turn into a database write every 2 seconds.
const SEEN_WRITE_EVERY_MS = 10 * 1000;
// Per server instance: the cleanup queries run at most this often.
const CLEANUP_EVERY_MS = 30 * 1000;
let lastCleanupAt = 0;
// A PENDING invite the opponent hasn't answered within this window is
// treated as cancelled (the challenger's waiting popup gives up too).
export const DUEL_INVITE_TTL_MS = 2 * 60 * 1000;

export type DuelQuestion = ReturnType<typeof getPublicView>;

// Identity of the visitor behind a share link: the link's quiz, plus the
// guestAccessId from the share cookie (null if the cookie is missing/stale).
export async function resolveGuest(token: string) {
  const link = await prisma.guestAccess.findUnique({ where: { token }, select: { id: true, quizId: true, guestName: true } });
  if (!link) return { error: "Lien invalide.", status: 404 } as const;
  const guestAccessId = await readGuestAccess(token);
  if (!guestAccessId) return { error: "Accès expiré.", status: 401 } as const;
  return { guestAccessId, quizId: link.quizId } as const;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isInviteExpired(duel: { status: DuelStatus; createdAt: Date }): boolean {
  return duel.status === "PENDING" && Date.now() - duel.createdAt.getTime() > DUEL_INVITE_TTL_MS;
}

// Chapters a round can be played on: enabled, regular (not "niveau 2", which
// may still be locked for one of the players) and with at least one question.
export async function getDuelThemes(quizId: string) {
  const links = await prisma.quizTheme.findMany({
    where: { quizId, enabled: true, parentThemeId: null },
    orderBy: { order: "asc" },
    select: { theme: { select: { id: true, title: true, _count: { select: { questions: true } } } } },
  });
  return links
    .filter((l) => l.theme._count.questions > 0)
    .map((l) => ({ id: l.theme.id, title: l.theme.title, questionCount: l.theme._count.questions }));
}

export async function drawRoundQuestions(themeId: string): Promise<DuelQuestion[]> {
  const questions = await prisma.question.findMany({ where: { themeId }, select: { id: true, type: true, content: true, section: true } });
  return shuffle(questions).slice(0, DUEL_QUESTIONS_PER_ROUND).map(getPublicView);
}

export async function cleanupDuels() {
  if (Date.now() - lastCleanupAt < CLEANUP_EVERY_MS) return;
  lastCleanupAt = Date.now();
  const now = Date.now();
  const idleBefore = new Date(now - DUEL_IDLE_MS);
  await prisma.duel.deleteMany({
    where: {
      OR: [
        {
          status: "ACTIVE",
          AND: [
            { OR: [{ challengerSeenAt: null }, { challengerSeenAt: { lt: idleBefore } }] },
            { OR: [{ opponentSeenAt: null }, { opponentSeenAt: { lt: idleBefore } }] },
          ],
        },
        { status: "ACTIVE", createdAt: { lt: new Date(now - DUEL_MAX_MS) } },
        { status: { not: "ACTIVE" }, updatedAt: { lt: new Date(now - DUEL_PURGE_MS) } },
      ],
    },
  });
}

// Draws the round's questions and starts its clock. Guarded on themeId still
// being null, so a late manual pick and the automatic one can't both apply.
export async function startRound(roundId: string, theme: { id: string; title: string }) {
  const questions = await drawRoundQuestions(theme.id);
  await prisma.duelRound.updateMany({
    where: { id: roundId, themeId: null },
    data: { themeId: theme.id, themeTitle: theme.title, questions: questions as never, startedAt: new Date() },
  });
}

// Run on every poll of the duel screen: records the player's presence, runs
// the cleanup, then moves the duel along on its own when a deadline passed
// (chapter not picked in time, round time over). Returns the up-to-date
// duel, or null if it no longer exists.
export async function tickDuel(duel: LoadedDuel, meId: string) {
  const seenField = duel.challengerId === meId ? "challengerSeenAt" : "opponentSeenAt";
  const seenAt = duel[seenField];
  if (!seenAt || Date.now() - seenAt.getTime() > SEEN_WRITE_EVERY_MS) {
    await prisma.duel.updateMany({ where: { id: duel.id }, data: { [seenField]: new Date() } });
  }
  await cleanupDuels();

  const round = duel.rounds[duel.rounds.length - 1];
  if (duel.status === "ACTIVE" && round) {
    if (!round.themeId && Date.now() - round.createdAt.getTime() > DUEL_CHOOSE_SECONDS * 1000) {
      const themes = await getDuelThemes(duel.quizId);
      if (themes.length > 0) await startRound(round.id, themes[Math.floor(Math.random() * themes.length)]);
    } else if (isPastDeadline(round)) {
      await advanceDuel(duel.id);
    }
  }
  return loadDuel(duel.id);
}

export function loadDuel(duelId: string) {
  return prisma.duel.findUnique({
    where: { id: duelId },
    include: {
      challenger: { select: { id: true, guestName: true } },
      opponent: { select: { id: true, guestName: true } },
      rounds: {
        orderBy: { index: "asc" },
        include: { answers: { select: { guestAccessId: true, questionId: true, isCorrect: true } } },
      },
    },
  });
}
type LoadedDuel = NonNullable<Awaited<ReturnType<typeof loadDuel>>>;
type LoadedRound = LoadedDuel["rounds"][number];

function roundTotal(round: { questions: unknown }): number {
  return Array.isArray(round.questions) ? round.questions.length : 0;
}

export function roundDeadline(round: { startedAt: Date | null }): Date | null {
  return round.startedAt ? new Date(round.startedAt.getTime() + DUEL_ROUND_SECONDS * 1000) : null;
}

export function isPastDeadline(round: { startedAt: Date | null }, graceMs = 0): boolean {
  const deadline = roundDeadline(round);
  return !!deadline && Date.now() > deadline.getTime() + graceMs;
}

export function isAnswerTooLate(round: { startedAt: Date | null }): boolean {
  return isPastDeadline(round, DUEL_ANSWER_GRACE_MS);
}

// Every question not answered correctly is a mistake, so unanswered ones
// (time ran out) count too.
function errorsOf(round: LoadedRound, guestId: string): number {
  return roundTotal(round) - round.answers.filter((a) => a.guestAccessId === guestId && a.isCorrect).length;
}

function answeredBy(round: LoadedRound, guestId: string): number {
  return round.answers.filter((a) => a.guestAccessId === guestId).length;
}

export function isRoundFinished(round: LoadedRound, duel: { challengerId: string; opponentId: string }): boolean {
  const total = roundTotal(round);
  if (total === 0) return false;
  if (isAnswerTooLate(round)) return true;
  return answeredBy(round, duel.challengerId) >= total && answeredBy(round, duel.opponentId) >= total;
}

// Fewer mistakes wins the round's point; equal mistakes gives both players the point.
function roundPoints(round: LoadedRound, duel: LoadedDuel) {
  const c = errorsOf(round, duel.challengerId);
  const o = errorsOf(round, duel.opponentId);
  return { challenger: c <= o ? 1 : 0, opponent: o <= c ? 1 : 0 };
}

// Called after each answer and on every state poll: once both players have
// answered every question of the current round, or its time is up, either opens the next round (chooser alternates) or
// ends the duel. Safe to call concurrently — the unique (duelId, index) and
// the status guard make the losing request a no-op.
export async function advanceDuel(duelId: string) {
  const duel = await loadDuel(duelId);
  if (!duel || duel.status !== "ACTIVE") return;
  const current = duel.rounds[duel.rounds.length - 1];
  if (!current || !isRoundFinished(current, duel)) return;

  if (duel.rounds.length >= duel.bestOf) {
    await prisma.duel.updateMany({ where: { id: duel.id, status: "ACTIVE" }, data: { status: "FINISHED" } });
    return;
  }
  const nextChooser = current.chooserId === duel.challengerId ? duel.opponentId : duel.challengerId;
  try {
    await prisma.duelRound.create({ data: { duelId: duel.id, index: current.index + 1, chooserId: nextChooser } });
  } catch (err) {
    if ((err as { code?: string }).code !== "P2002") throw err;
  }
}

// Everything the duel screen needs, from `meId`'s point of view. The current
// round's questions are only sent through the dedicated questions endpoint.
export async function buildDuelState(duel: LoadedDuel, meId: string) {
  const isChallenger = duel.challengerId === meId;
  const me = isChallenger ? duel.challenger : duel.opponent;
  const other = isChallenger ? duel.opponent : duel.challenger;

  let status = duel.status;
  if (isInviteExpired(duel)) {
    await prisma.duel.updateMany({ where: { id: duel.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    status = "CANCELLED";
  }

  const score = { me: 0, opponent: 0 };
  const rounds = duel.rounds.map((round) => {
    const finished = isRoundFinished(round, duel);
    if (finished) {
      const pts = roundPoints(round, duel);
      score.me += isChallenger ? pts.challenger : pts.opponent;
      score.opponent += isChallenger ? pts.opponent : pts.challenger;
    }
    return {
      index: round.index,
      iChoose: round.chooserId === meId,
      themeId: round.themeId,
      themeTitle: round.themeTitle,
      deadline: roundDeadline(round)?.toISOString() ?? null,
      chooseDeadline: round.themeId ? null : new Date(round.createdAt.getTime() + DUEL_CHOOSE_SECONDS * 1000).toISOString(),
      total: roundTotal(round),
      myAnswered: answeredBy(round, meId),
      opponentAnswered: answeredBy(round, other.id),
      // The opponent's mistakes stay hidden until the round is over.
      myErrors: finished ? errorsOf(round, meId) : null,
      opponentErrors: finished ? errorsOf(round, other.id) : null,
      finished,
    };
  });

  let outcome: "win" | "loss" | "tie" | null = null;
  if (status === "FINISHED") outcome = score.me > score.opponent ? "win" : score.me < score.opponent ? "loss" : "tie";
  if (status === "ABANDONED") outcome = duel.abandonedById === meId ? "loss" : "win";

  const current = rounds[rounds.length - 1];
  const themes = status === "ACTIVE" && current && current.iChoose && !current.themeId ? await getDuelThemes(duel.quizId) : [];

  return {
    id: duel.id,
    status,
    bestOf: duel.bestOf,
    isChallenger,
    me: { id: me.id, name: me.guestName ?? "Invite sans nom" },
    opponent: { id: other.id, name: other.guestName ?? "Invite sans nom" },
    rounds,
    score,
    outcome,
    themes,
  };
}
export type DuelState = Awaited<ReturnType<typeof buildDuelState>>;
