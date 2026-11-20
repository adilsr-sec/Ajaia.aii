import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { exportDocumentAsMarkdown } from "@/lib/exporter";
import { handleApiError, ServiceError } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "md").toLowerCase();

    if (format !== "md" && format !== "markdown") {
      throw new ServiceError(
        400,
        "Unsupported export format. Supported format: md"
      );
    }

    const { filename, markdown } = await exportDocumentAsMarkdown(user.id, id);

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
