import sanitizeHtml from "sanitize-html";

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
];

export function sanitizeRichHtml(dirtyHtml: string): string {
  if (!dirtyHtml) {
    return "";
  }

  return sanitizeHtml(dirtyHtml, {
    allowedTags: ALLOWED_RICH_TEXT_TAGS,
    allowedAttributes: {},
    allowedSchemes: [],
    disallowedTagsMode: "discard",
    nonTextTags: [
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
    ],
  }).trim();
}

export function sanitizeTitle(raw: string, fallback = "Untitled Document"): string {
  const plain = sanitizeHtml(raw, {
    allowedTags: [],
    allowedAttributes: {},
  });
  const cleaned = plain
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return fallback;
  }

  return cleaned.slice(0, 120).trim() || fallback;
}
