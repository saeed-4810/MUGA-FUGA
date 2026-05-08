import { NextResponse, type NextRequest } from "next/server";

import { getFirebaseAdminAuth } from "../../src/lib/server/firebase-admin";
import {
  SESSION_COOKIE_NAME,
  SESSION_EXPIRES_IN_MS,
  createServerSessionCookie,
  isValidIdTokenInput,
} from "../../src/lib/server/session";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { idToken?: unknown };
  if (!isValidIdTokenInput(body.idToken)) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Missing idToken" }, { status: 400 });
  }
  const sessionCookie = await createServerSessionCookie(getFirebaseAdminAuth(), body.idToken);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    maxAge: Math.floor(SESSION_EXPIRES_IN_MS / 1000),
    path: "/",
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
  });
  return response;
}
