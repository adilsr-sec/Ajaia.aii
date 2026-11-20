import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import {
  deleteDocument,
  getDocumentById,
  updateDocument,
  updateDocumentSchema,
} from "@/lib/documents";
import { handleApiError, ServiceError } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const doc = await getDocumentById(user.id, id);
    return NextResponse.json(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ServiceError(400, "Invalid JSON request body");
    }

    const parsed = updateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ServiceError(
        400,
        parsed.error.issues[0]?.message || "Invalid update payload"
      );
    }

    const doc = await updateDocument(user.id, id, parsed.data);
    return NextResponse.json(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const result = await deleteDocument(user.id, id);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
