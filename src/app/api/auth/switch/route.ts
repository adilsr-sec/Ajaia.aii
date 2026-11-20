import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  signUserId,
  buildSessionCookieOptions,
} from "@/lib/auth";
import { handleApiError, ServiceError } from "@/lib/errors";

const switchSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address"),
});

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ServiceError(400, "Invalid JSON request body");
    }

    const parsed = switchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ServiceError(
        400,
        parsed.error.issues[0]?.message || "Invalid email"
      );
    }

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        avatarColor: true,
      },
    });

    if (!user) {
      throw new ServiceError(404, "Demo account not found");
    }

    const signed = signUserId(user.id);
    const response = NextResponse.json({ user });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      signed,
      buildSessionCookieOptions(request)
    );

    return response;
  } catch (err) {
    return handleApiError(err);
  }
}
