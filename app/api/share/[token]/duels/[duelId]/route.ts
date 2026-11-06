import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveGuest, loadDuel, buildDuelState, isInviteExpired, getDuelThemes, startRound, tickDuel } from "@/lib/duel";

async function loadForGuest(token: string, duelId: string) {
  const guest = await resolveGuest(token);
  if ("error" in guest) return { error: NextResponse.json({ error: guest.error }, { status: guest.status }) };
  const duel = await loadDuel(duelId);
  if (!duel || duel.quizId !== guest.quizId || (duel.challengerId !== guest.guestAccessId && duel.opponentId !== guest.guestAccessId)) {
    return { error: NextResponse.json({ error: "Duel introuvable." }, { status: 404 }) };
  }
  return { duel, me: guest.guestAccessId };
}

// Polled by both players' duel screens (and the challenger's waiting popup).
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; duelId: string }> }) {
  const { token, duelId } = await params;
  const loaded = await loadForGuest(token, duelId);
  if ("error" in loaded) return loaded.error;
  const duel = await tickDuel(loaded.duel, loaded.me);
  if (!duel) return NextResponse.json({ error: "Ce duel a ete supprime (joueurs absents ou duel trop long)." }, { status: 404 });
  return NextResponse.json(await buildDuelState(duel, loaded.me));
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("decline") }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("abandon") }),
  z.object({ action: z.literal("choose"), themeId: z.string() }),
]);

// Every status change goes through updateMany with the expected current
// status in the WHERE clause, so a stale or doubled click is a no-op.
export async function POST(request: Request, { params }: { params: Promise<{ token: string; duelId: string }> }) {
  const { token, duelId } = await params;
  const loaded = await loadForGuest(token, duelId);
  if ("error" in loaded) return loaded.error;
  const { duel, me } = loaded;

  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  switch (body.action) {
    case "accept": {
      if (duel.opponentId !== me) return NextResponse.json({ error: "Seul l'adversaire peut accepter." }, { status: 403 });
      if (isInviteExpired(duel)) return NextResponse.json({ error: "Ce défi a expiré." }, { status: 409 });
      // The player choosing the first chapter is drawn at random.
      const firstChooser = Math.random() < 0.5 ? duel.challengerId : duel.opponentId;
      await prisma.$transaction(async (tx) => {
        // Both players count as present from the start, so the idle cleanup
        // doesn't catch the duel before their duel screens first load.
        const now = new Date();
        const { count } = await tx.duel.updateMany({
          where: { id: duel.id, status: "PENDING" },
          data: { status: "ACTIVE", challengerSeenAt: now, opponentSeenAt: now },
        });
        if (count === 1) await tx.duelRound.create({ data: { duelId: duel.id, index: 0, chooserId: firstChooser } });
      });
      break;
    }
    case "decline":
      if (duel.opponentId !== me) return NextResponse.json({ error: "Seul l'adversaire peut refuser." }, { status: 403 });
      await prisma.duel.updateMany({ where: { id: duel.id, status: "PENDING" }, data: { status: "DECLINED" } });
      break;
    case "cancel":
      if (duel.challengerId !== me) return NextResponse.json({ error: "Seul le lanceur du défi peut l'annuler." }, { status: 403 });
      await prisma.duel.updateMany({ where: { id: duel.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      break;
    case "abandon":
      await prisma.duel.updateMany({ where: { id: duel.id, status: "ACTIVE" }, data: { status: "ABANDONED", abandonedById: me } });
      break;
    case "choose": {
      const round = duel.rounds[duel.rounds.length - 1];
      if (duel.status !== "ACTIVE" || !round || round.chooserId !== me || round.themeId) {
        return NextResponse.json({ error: "Ce n'est pas à vous de choisir le chapitre." }, { status: 409 });
      }
      const theme = (await getDuelThemes(duel.quizId)).find((t) => t.id === body.themeId);
      if (!theme) return NextResponse.json({ error: "Chapitre introuvable." }, { status: 404 });
      await startRound(round.id, theme);
      break;
    }
  }

  const fresh = await loadDuel(duel.id);
  return NextResponse.json(await buildDuelState(fresh!, me));
}
