import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session-user";
import { correctFreeTextAnswer } from "@/lib/correction";

const correctionRequestSchema = z.object({
  enonce: z.string().min(1),
  reponseAttendue: z.string().min(1),
  reponseUtilisateur: z.string().min(1),
});

// Standalone endpoint kept for direct/manual correction requests (e.g. future
// mobile client). The attempts flow (/api/attempts) calls the same
// lib/correction.ts helper in-process instead of hitting this over HTTP.
export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const parsed = correctionRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await correctFreeTextAnswer(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur de correction IA.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
