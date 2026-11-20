import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({
      ok: true,
      database: "connected",
      seededUsers: userCount,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Database connection failed";
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        error: message,
      },
      { status: 500 }
    );
  }
}
