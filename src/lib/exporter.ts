import type { PrismaClient } from "@prisma/client";
import { Parser } from "htmlparser2";
import { prisma } from "@/lib/prisma";
import { getDocumentById } from "@/lib/documents";

interface ListFrame {
  type: "ul" | "ol";
  index: number;
}

export function sanitizeDownloadFilename(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();

  return cleaned || "document";
}

/**
 * Converts sanitized rich-text HTML into clean Markdown using pure-ESM htmlparser2.
 */
export function convertHtmlToMarkdown(html: string): string {
  if (!html || !html.trim()) {
    return "";
  }

  const out: string[] = [];
  const listStack: ListFrame[] = [];
  let inPre = false;
  let inCode = false;
  let inBlockquote = false;
  let listItemDepth = 0;

  const ensureBlankLine = () => {
    const joined = out.join("");
    if (!joined || joined.endsWith("\n\n")) return;
    if (joined.endsWith("\n")) {
      out.push("\n");
    } else {
      out.push("\n\n");
    }
  };

  const ensureLineBreak = () => {
    const joined = out.join("");
    if (!joined || joined.endsWith("\n")) return;
    out.push("\n");
  };

  const parser = new Parser(
    {
      onopentag(rawName) {
        const tag = rawName.toLowerCase();

        switch (tag) {
          case "h1":
            ensureBlankLine();
            out.push("# ");
            break;
          case "h2":
            ensureBlankLine();
            out.push("## ");
            break;
          case "h3":
            ensureBlankLine();
            out.push("### ");
            break;
          case "p":
            if (listItemDepth === 0) {
              ensureBlankLine();
              if (inBlockquote) {
                out.push("> ");
              }
            }
            break;
          case "br":
            out.push("\n");
            break;
          case "strong":
          case "b":
            out.push("**");
            break;
          case "em":
          case "i":
            out.push("*");
            break;
          case "u":
            out.push("<u>");
            break;
          case "ul":
            if (listStack.length === 0) ensureBlankLine();
            else ensureLineBreak();
            listStack.push({ type: "ul", index: 0 });
            break;
          case "ol":
            if (listStack.length === 0) ensureBlankLine();
            else ensureLineBreak();
            listStack.push({ type: "ol", index: 0 });
            break;
          case "li": {
            listItemDepth++;
            ensureLineBreak();
            const currentList = listStack[listStack.length - 1];
            const indent = "  ".repeat(Math.max(0, listStack.length - 1));
            if (currentList?.type === "ol") {
              currentList.index += 1;
              out.push(`${indent}${currentList.index}. `);
            } else {
              out.push(`${indent}- `);
            }
            break;
          }
          case "blockquote":
            ensureBlankLine();
            inBlockquote = true;
            break;
          case "pre":
            ensureBlankLine();
            inPre = true;
            out.push("```\n");
            break;
          case "code":
            inCode = true;
            if (!inPre) {
              out.push("`");
            }
            break;
          default:
            break;
        }
      },

      ontext(text) {
        if (inPre || inCode) {
          out.push(text);
          return;
        }
        const collapsed = text.replace(/\s+/g, " ");
        if (!collapsed) return;
        // Avoid leading space right after block prefixes (# , - , 1. , > , newline)
        const prev = out[out.length - 1] ?? "";
        if (
          collapsed === " " &&
          (prev === "" || prev.endsWith("\n") || prev.endsWith(" "))
        ) {
          return;
        }
        out.push(collapsed);
      },

      onclosetag(rawName) {
        const tag = rawName.toLowerCase();

        switch (tag) {
          case "h1":
          case "h2":
          case "h3":
            ensureBlankLine();
            break;
          case "p":
            if (listItemDepth === 0) {
              ensureBlankLine();
            }
            break;
          case "strong":
          case "b":
            out.push("**");
            break;
          case "em":
          case "i":
            out.push("*");
            break;
          case "u":
            out.push("</u>");
            break;
          case "li":
            listItemDepth = Math.max(0, listItemDepth - 1);
            ensureLineBreak();
            break;
          case "ul":
          case "ol":
            listStack.pop();
            if (listStack.length === 0) {
              ensureBlankLine();
            }
            break;
          case "blockquote":
            inBlockquote = false;
            ensureBlankLine();
            break;
          case "code":
            if (!inPre) {
              out.push("`");
            }
            inCode = false;
            break;
          case "pre":
            if (!out.join("").endsWith("\n")) {
              out.push("\n");
            }
            out.push("```\n\n");
            inPre = false;
            break;
          default:
            break;
        }
      },
    },
    {
      decodeEntities: true,
      recognizeSelfClosing: true,
    }
  );

  parser.write(html);
  parser.end();

  return out
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function exportDocumentAsMarkdown(
  currentUserId: string,
  documentId: string,
  db: PrismaClient = prisma
): Promise<{ filename: string; markdown: string; title: string }> {
  const doc = await getDocumentById(currentUserId, documentId, db);
  const bodyMarkdown = convertHtmlToMarkdown(doc.contentHtml);

  // Prefix with document title as H1 only if body doesn't already start with an H1
  const startsWithH1 = /^#\s+/.test(bodyMarkdown);
  const markdown = startsWithH1
    ? `${bodyMarkdown}\n`
    : bodyMarkdown
      ? `# ${doc.title}\n\n${bodyMarkdown}\n`
      : `# ${doc.title}\n`;

  const filename = `${sanitizeDownloadFilename(doc.title)}.md`;
  return { filename, markdown, title: doc.title };
}
