import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveGuest, DUEL_BEST_OF, DUEL_INVITE_TTL_MS } from "@/lib/duel";

const createDuelSchema = z.object({
  opponentId: z.string(),
  bestOf: z.union(DUEL_BEST_OF.map((n) => z.literal(n))),
});

// Sends a duel invite to another guest link of the same quiz. Any earlier
// invite this guest left pending is cancelled, so only one waits at a time.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const guest = await resolveGuest(token);
  if ("error" in guest) return NextResponse.json({ error: guest.error }, { status: guest.status });

  const parsed = createDuelSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { opponentId, bestOf } = parsed.data;

  if (opponentId === guest.guestAccessId) return NextResponse.json({ error: "Vous ne pouvez pas vous défier vous-même." }, { status: 400 });
  const opponent = await prisma.guestAccess.findUnique({ where: { id: opponentId }, select: { quizId: true } });
  if (!opponent || opponent.quizId !== guest.quizId) return NextResponse.json({ error: "Adversaire introuvable." }, { status: 404 });

  const duel = await prisma.$transaction(async (tx) => {
    await tx.duel.updateMany({ where: { challengerId: guest.guestAccessId, status: "PENDING" }, data: { status: "CANCELLED" } });
    return tx.duel.create({ data: { quizId: guest.quizId, challengerId: guest.guestAccessId, opponentId, bestOf } });
  });

  return NextResponse.json({ id: duel.id }, { status: 201 });
}

// Polled by the main menu: the most recent fresh invite addressed to this
// guest, and the duel they're currently playing (to offer resuming it).
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const guest = await resolveGuest(token);
  if ("error" in guest) return NextResponse.json({ error: guest.error }, { status: guest.status });
  const me = guest.guestAccessId;

  const [invite, active] = await Promise.all([
    prisma.duel.findFirst({
      where: { opponentId: me, status: "PENDING", createdAt: { gt: new Date(Date.now() - DUEL_INVITE_TTL_MS) } },
      orderBy: { createdAt: "desc" },
      select: { id: true, bestOf: true, challenger: { select: { guestName: true } } },
    }),
    prisma.duel.findFirst({
      where: { status: "ACTIVE", OR: [{ challengerId: me }, { opponentId: me }] },
      orderBy: { updatedAt: "desc" },
      select: { id: true, challengerId: true, challenger: { select: { guestName: true } }, opponent: { select: { guestName: true } } },
    }),
  ]);

  return NextResponse.json({
    invite: invite && { id: invite.id, bestOf: invite.bestOf, from: invite.challenger.guestName ?? "Invite sans nom" },
    active: active && {
      id: active.id,
      against: (active.challengerId === me ? active.opponent.guestName : active.challenger.guestName) ?? "Invite sans nom",
    },
  });
}
