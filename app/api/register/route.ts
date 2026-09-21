import { NextResponse } from "next/server";

// Self-service signup is closed: existing accounts still work, but new ones
// can no longer be created through this endpoint.
export async function POST() {
  return NextResponse.json({ error: "Les inscriptions sont actuellement fermées." }, { status: 403 });
}
