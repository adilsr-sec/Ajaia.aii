import type { PrismaClient } from "@prisma/client";
import { marked } from "marked";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/errors";
import { sanitizeRichHtml, sanitizeTitle } from "@/lib/sanitize";
import { createDocument, type DocumentDetail } from "@/lib/documents";

export const MAX_IMPORT_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_IMPORT_EXTENSIONS = [".txt", ".md"] as const;

export interface ImportFileInput {
  filename: string;
  size: number;
  content: string;
}

function getFileExtension(filename: string): string {
  const baseName = filename.split(/[\\/]/).pop() ?? "";
  const dotIndex = baseName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return "";
  }
  return baseName.slice(dotIndex).toLowerCase();
}

export function deriveTitleFromFilename(filename: string): string {
  const baseName = filename.split(/[\\/]/).pop() ?? "";
  const withoutExt = baseName.replace(/\.(txt|md)$/i, "");
  return sanitizeTitle(withoutExt, "Imported Document");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function convertPlainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const trimmed = normalized.trim();
  if (!trimmed) {
    return "<p></p>";
  }

  const paragraphs = trimmed.split(/\n{2,}/);
  return paragraphs
    .map((para) => {
      const escaped = escapeHtml(para.trim());
      return `<p>${escaped.replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

export function convertMarkdownToHtml(markdown: string): string {
  const rendered = marked.parse(markdown, {
    async: false,
    gfm: true,
    breaks: false,
  });
  return typeof rendered === "string" ? rendered : "";
}

export function parseAndConvertImportFile(input: ImportFileInput): {
  title: string;
  contentHtml: string;
} {
  const { filename, size, content } = input;

  if (!filename || !filename.trim()) {
    throw new ServiceError(400, "Missing file name");
  }

  const ext = getFileExtension(filename);
  if (
    !ALLOWED_IMPORT_EXTENSIONS.includes(
      ext as (typeof ALLOWED_IMPORT_EXTENSIONS)[number]
    )
  ) {
    throw new ServiceError(
      400,
      "Unsupported file type. Only .txt and .md files are allowed."
    );
  }

  if (size <= 0) {
    throw new ServiceError(
      400,
      "File is empty. Please upload a non-empty .txt or .md file."
    );
  }

  if (size > MAX_IMPORT_FILE_SIZE) {
    throw new ServiceError(
      400,
      "File exceeds the maximum size limit of 2 MB."
    );
  }

  const title = deriveTitleFromFilename(filename);
  const rawHtml =
    ext === ".md"
      ? convertMarkdownToHtml(content)
      : convertPlainTextToHtml(content);

  const contentHtml = sanitizeRichHtml(rawHtml);

  return { title, contentHtml };
}

export async function importDocumentFromFile(
  currentUserId: string,
  input: ImportFileInput,
  db: PrismaClient = prisma
): Promise<DocumentDetail> {
  const { title, contentHtml } = parseAndConvertImportFile(input);
  return createDocument(currentUserId, { title, contentHtml }, db);
}
