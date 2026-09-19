import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mintGuestAccess, setGuestCookie } from "@/lib/guest-access";

// The canonical share link (also encoded in the QR code / handed out as the
// raw access key). Every visit mints a fresh GuestAccess.activeToken, which
// invalidates whatever cookie a previously active device was holding.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.guestAccess.findUnique({ where: { token }, select: { id: true } });
  if (!link) return NextResponse.json({ error: "Lien invalide ou désactivé." }, { status: 404 });

  const access = await mintGuestAccess(token);
  const response = NextResponse.redirect(new URL(`/share/${token}/play`, request.url));
  setGuestCookie(response, token, access.activeToken);
  return response;
}
