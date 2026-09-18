import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export function guestCookieName(quizId: string): string {
  return `qz_guest_${quizId}`;
}

// Called when the raw share link is opened. Overwrites any previous
// activeToken, which is what makes a cookie held by a previous device stale.
export async function mintGuestAccess(quizId: string) {
  const activeToken = crypto.randomBytes(24).toString("hex");
  return prisma.guestAccess.upsert({
    where: { quizId },
    update: { activeToken },
    create: { quizId, activeToken },
  });
}

export function setGuestCookie(response: NextResponse, quizId: string, activeToken: string) {
  response.cookies.set(guestCookieName(quizId), activeToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

// Validates the visitor's cookie against the quiz's current GuestAccess row.
// Returns the guestAccessId to attribute attempts to, or null if there's no
// active/matching guest session (link never opened, or displaced by someone
// re-opening the link on another device).
export async function readGuestAccess(quizId: string): Promise<string | null> {
  const store = await cookies();
  const token = store.get(guestCookieName(quizId))?.value;
  if (!token) return null;

  const access = await prisma.guestAccess.findUnique({ where: { quizId }, select: { id: true, activeToken: true } });
  if (!access || access.activeToken !== token) return null;
  return access.id;
}
