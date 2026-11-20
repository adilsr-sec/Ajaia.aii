import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { revokeDocumentShare } from "@/lib/documents";
import { handleApiError } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ id: string; userId: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id, userId } = await context.params;
    const result = await revokeDocumentShare(user.id, id, userId);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
