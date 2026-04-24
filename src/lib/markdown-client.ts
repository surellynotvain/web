"use client";

// client-side markdown → sanitized html for the editor preview.
// mirrors src/lib/blog.ts renderMarkdown() so WYSIWYG stays honest.
import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: true });

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "strong", "em", "s", "del", "ins",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
];

const ALLOWED_ATTR = ["href", "title", "alt", "src", "class", "target", "rel"];
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto):|\/|\.{1,2}\/|#)/i;

export function renderMarkdownClient(md: string): string {
  if (!md.trim()) return "";
  const raw = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ADD_ATTR: ["target"],
  });
}
