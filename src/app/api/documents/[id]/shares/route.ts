import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { shareDocumentSchema, upsertDocumentShare } from "@/lib/documents";
import { handleApiError, ServiceError } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ServiceError(400, "Invalid JSON request body");
    }

    const parsed = shareDocumentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ServiceError(
        400,
        parsed.error.issues[0]?.message || "Invalid share payload"
      );
    }

    const result = await upsertDocumentShare(user.id, id, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
