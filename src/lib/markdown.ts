import "server-only";
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

/** Render markdown to sanitized HTML. Server-only. */
export function renderMarkdown(md: string): string {
  if (!md) return "";
  const raw = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ADD_ATTR: ["target"],
  });
}

/** Force external links to open in new tab with safe rel. */
export function autoRelNoopener(html: string): string {
  return html.replace(/<a\s+([^>]*?)href=/gi, (_m, pre) => {
    const hasTarget = /target=/i.test(pre);
    const rel = ' rel="noopener noreferrer ugc"';
    return `<a ${hasTarget ? pre : pre + 'target="_blank" '}${rel}href=`;
  });
}
