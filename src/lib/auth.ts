import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/errors";

export const SESSION_COOKIE_NAME = "ajaia_user_id";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    "ajaia-docs-dev-fallback-secret-change-in-production"
  );
}

function computeSignature(userId: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(userId)
    .digest("hex");
}

export function signUserId(userId: string): string {
  const sig = computeSignature(userId);
  return `${userId}.${sig}`;
}

export function verifySignedUserId(token: string | undefined): string | null {
  if (!token) {
    return null;
  }

  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === token.length - 1) {
    return null;
  }

  const userId = token.slice(0, lastDot);
  const providedSig = token.slice(lastDot + 1);
  const expectedSig = computeSignature(userId);

  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");

  if (providedBuf.length !== expectedBuf.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  return userId;
}

export async function getCurrentUser(
  db: PrismaClient = prisma
): Promise<UserSummary | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const userId = verifySignedUserId(rawToken);
  if (!userId) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatarColor: true,
    },
  });

  return user;
}

export async function requireCurrentUser(
  db: PrismaClient = prisma
): Promise<UserSummary> {
  const user = await getCurrentUser(db);
  if (!user) {
    throw new ServiceError(401, "Unauthorized");
  }
  return user;
}

export async function getDemoUsers(
  db: PrismaClient = prisma
): Promise<UserSummary[]> {
  return db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      avatarColor: true,
    },
    orderBy: { email: "asc" },
  });
}

export function buildSessionCookieOptions(req?: Request) {
  const forwardedProto = req?.headers.get("x-forwarded-proto");
  const isHttps =
    forwardedProto === "https" ||
    Boolean(req?.url && req.url.startsWith("https://"));

  return {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: (isHttps ? "none" : "lax") as "none" | "lax",
    secure: isHttps,
  };
}
