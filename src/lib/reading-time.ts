import { WORDS_PER_MINUTE } from "@/lib/constants";

/**
 * Very rough reading-time estimate. Strips markdown syntax/URLs and counts
 * whitespace-delimited tokens. Good enough for "6 min read" labels.
 */
export function readingTime(markdown: string): { minutes: number; words: number } {
  if (!markdown) return { minutes: 0, words: 0 };
  const cleaned = markdown
    // strip fenced code blocks
    .replace(/```[\s\S]*?```/g, " ")
    // strip inline code
    .replace(/`[^`]*`/g, " ")
    // strip image/link syntax but keep text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // strip markdown headings / emphasis markers
    .replace(/[#*_>~-]/g, " ");
  const words = cleaned.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return { minutes, words };
}
