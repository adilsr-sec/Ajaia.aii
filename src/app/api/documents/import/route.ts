import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { handleApiError, ServiceError } from "@/lib/errors";
import {
  importDocumentFromFile,
  MAX_IMPORT_FILE_SIZE,
} from "@/lib/importer";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new ServiceError(400, "Expected multipart/form-data upload");
    }

    const fileEntry = formData.get("file");
    if (!fileEntry || !(fileEntry instanceof File)) {
      throw new ServiceError(
        400,
        "Missing file. Please select a .txt or .md file to import."
      );
    }

    if (fileEntry.size > MAX_IMPORT_FILE_SIZE) {
      throw new ServiceError(
        400,
        "File exceeds the maximum size limit of 2 MB."
      );
    }

    const content = fileEntry.size > 0 ? await fileEntry.text() : "";

    const doc = await importDocumentFromFile(user.id, {
      filename: fileEntry.name,
      size: fileEntry.size,
      content,
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
