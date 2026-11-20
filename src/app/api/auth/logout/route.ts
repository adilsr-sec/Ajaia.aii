import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, buildSessionCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...buildSessionCookieOptions(request),
    maxAge: 0,
  });
  return response;
}
