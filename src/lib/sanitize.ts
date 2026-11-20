import { Parser } from "htmlparser2";

export const ALLOWED_RICH_TEXT_TAGS = [
  "h1",
  "h2",
  "h3",
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
] as const;

const ALLOWED_TAG_SET = new Set<string>(ALLOWED_RICH_TEXT_TAGS);
const VOID_TAGS = new Set<string>(["br"]);

const DISCARD_CONTENT_TAGS = new Set<string>([
  "script",
  "style",
  "textarea",
  "option",
  "noscript",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
]);

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Strict allowlist HTML sanitizer built directly on htmlparser2 (pure ESM).
 * Strips all disallowed tags, drops inner payloads of dangerous non-text tags
 * (script, style, iframe, svg, etc.), removes all attributes/event handlers,
 * and balances open tags cleanly.
 */
export function sanitizeRichHtml(dirtyHtml: string): string {
  if (!dirtyHtml) {
    return "";
  }

  const output: string[] = [];
  const openStack: string[] = [];
  let discardDepth = 0;

  const parser = new Parser(
    {
      onopentag(rawName) {
        const tag = rawName.toLowerCase();

        if (DISCARD_CONTENT_TAGS.has(tag)) {
          discardDepth++;
          return;
        }

        if (discardDepth > 0) {
          return;
        }

        if (!ALLOWED_TAG_SET.has(tag)) {
          return;
        }

        if (VOID_TAGS.has(tag)) {
          output.push(`<${tag} />`);
          return;
        }

        openStack.push(tag);
        output.push(`<${tag}>`);
      },

      ontext(text) {
        if (discardDepth > 0) {
          return;
        }
        output.push(escapeHtmlText(text));
      },

      onclosetag(rawName) {
        const tag = rawName.toLowerCase();

        if (DISCARD_CONTENT_TAGS.has(tag)) {
          if (discardDepth > 0) {
            discardDepth--;
          }
          return;
        }

        if (discardDepth > 0 || !ALLOWED_TAG_SET.has(tag) || VOID_TAGS.has(tag)) {
          return;
        }

        const idx = openStack.lastIndexOf(tag);
        if (idx === -1) {
          return;
        }

        // Close any nested unclosed tags cleanly up to the matching open tag
        while (openStack.length > idx) {
          const popped = openStack.pop()!;
          output.push(`</${popped}>`);
        }
      },
    },
    {
      decodeEntities: true,
      recognizeSelfClosing: true,
    }
  );

  parser.write(dirtyHtml);
  parser.end();

  while (openStack.length > 0) {
    const popped = openStack.pop()!;
    output.push(`</${popped}>`);
  }

  return output.join("").trim();
}

export function sanitizeTitle(
  raw: string,
  fallback = "Untitled Document"
): string {
  if (!raw) {
    return fallback;
  }

  const textParts: string[] = [];
  let discardDepth = 0;

  const parser = new Parser(
    {
      onopentag(rawName) {
        if (DISCARD_CONTENT_TAGS.has(rawName.toLowerCase())) {
          discardDepth++;
        }
      },
      ontext(text) {
        if (discardDepth === 0) {
          textParts.push(text);
        }
      },
      onclosetag(rawName) {
        if (DISCARD_CONTENT_TAGS.has(rawName.toLowerCase()) && discardDepth > 0) {
          discardDepth--;
        }
      },
    },
    {
      decodeEntities: true,
      recognizeSelfClosing: true,
    }
  );

  parser.write(raw);
  parser.end();

  const cleaned = textParts
    .join("")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return fallback;
  }

  return cleaned.slice(0, 120).trim() || fallback;
}
