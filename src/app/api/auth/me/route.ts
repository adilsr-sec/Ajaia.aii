import { NextResponse } from "next/server";
import { getCurrentUser, getDemoUsers } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";

export async function GET() {
  try {
    const [user, demoUsers] = await Promise.all([
      getCurrentUser(),
      getDemoUsers(),
    ]);

    return NextResponse.json({ user, demoUsers });
  } catch (err) {
    return handleApiError(err);
  }
}
