import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import {
  createDocument,
  createDocumentSchema,
  listDocumentsForUser,
} from "@/lib/documents";
import { handleApiError, ServiceError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const result = await listDocumentsForUser(user.id);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();

    let body: unknown = {};
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        body = await request.json();
      } catch {
        throw new ServiceError(400, "Invalid JSON request body");
      }
    }

    const parsed = createDocumentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ServiceError(
        400,
        parsed.error.issues[0]?.message || "Invalid document payload"
      );
    }

    const doc = await createDocument(user.id, parsed.data);
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
