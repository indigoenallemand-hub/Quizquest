import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export function guestCookieName(linkToken: string): string {
  return `qz_guest_${linkToken}`;
}

// Called when a share link is opened. Overwrites the link's activeToken,
// which is what makes a cookie held by a previous device stale.
export async function mintGuestAccess(linkToken: string) {
  const activeToken = crypto.randomBytes(24).toString("hex");
  return prisma.guestAccess.update({
    where: { token: linkToken },
    data: { activeToken },
  });
}

export function setGuestCookie(response: NextResponse, linkToken: string, activeToken: string) {
  response.cookies.set(guestCookieName(linkToken), activeToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

// Validates the visitor's cookie against this link's current GuestAccess row.
// Returns the guestAccessId to attribute attempts to, or null if there's no
// active/matching guest session (link never opened, or displaced by someone
// re-opening the same link on another device).
export async function readGuestAccess(linkToken: string): Promise<string | null> {
  const store = await cookies();
  const token = store.get(guestCookieName(linkToken))?.value;
  if (!token) return null;

  const access = await prisma.guestAccess.findUnique({ where: { token: linkToken }, select: { id: true, activeToken: true } });
  if (!access || access.activeToken !== token) return null;
  return access.id;
}
