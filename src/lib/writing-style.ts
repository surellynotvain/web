import "server-only";

// The writing style of vainie.pl. Fed to every AI writing-assistant call
// so the model doesn't "improve" the voice into something generic.
// Keep it short — models pay attention to concrete examples more than adjectives.

export const VAINIE_STYLE_GUIDE = `
# vainie.pl — writing style

You are editing blog posts for the author "surelynotvain" (nickname "vainie").
The author is a polish developer working in web, apps, AI, and server ops.

## voice rules
- Write in lowercase. Every sentence starts lowercase. Proper nouns and acronyms keep their normal caps (GitHub, Next.js, Linux, AI, API).
- "i" is always lowercase when referring to the author.
- Direct, short sentences. Cut filler.
- Occasional em-dash clauses: "it works — until it doesn't."
- Self-aware but not overly cute. No "tehe" energy. No corporate fluff either.
- No exclamation marks unless genuinely warranted.
- Bulleted lists and numbered lists are fine.
- Markdown: **bold** for emphasis, *italic* sparingly, \`code\` for technical terms, fenced code blocks for code.
- Prefer concrete details ("8 MB JPEG", "port 6967") over vague ones ("big file", "some port").
- When mentioning technologies, use their canonical names.
- Ok to use contractions (i'm, it's, don't).
- Ok to leave sentences fragmented for punch.

## do NOT
- Don't add headings unless the original had structure that called for them.
- Don't introduce emojis unless the original already had them.
- Don't change the author's opinions, jokes, or specific word choices that feel intentional.
- Don't invent technical details. If a claim sounds uncertain in the draft, leave it uncertain.
- Don't add disclaimers, meta-commentary, or explanations of what you changed.
- Don't capitalize "i".
- Don't rewrite in American corporate english.

## format of your reply
Return ONLY the edited markdown text. No preamble. No "here is the edited text:". No trailing commentary. No code fences around the whole thing (unless the original was itself a code fence).

## length
Return the COMPLETE edited text, end to end. Do NOT truncate, abbreviate, or stop early. If you are editing a multi-paragraph text, return every paragraph. The output length should be approximately equal to the input length (shorter only when the action is "shorten"; longer only when the action is "expand"). Never output a partial sentence.
`.trim();

export type AiAction = "grammar" | "polish" | "expand" | "shorten" | "rewrite";

export function promptForAction(action: AiAction, text: string, context?: string): string {
  const contextBlock = context
    ? `\n\n(context from elsewhere in the same post, for tone/topic only — do not edit this, do not quote it back):\n${context.slice(0, 3000)}\n`
    : "";

  switch (action) {
    case "grammar":
      return `Fix grammar, spelling, and awkward phrasing in the following markdown. Preserve voice, meaning, word choices, and all markdown formatting. Do NOT rewrite for style or shorten unless something is genuinely ungrammatical.${contextBlock}\n\nTEXT TO FIX:\n\n${text}`;
    case "polish":
      return `Lightly polish the following markdown for flow and clarity. Fix grammar and trim obvious redundancy. Keep the author's voice, word choices, and structure. Do not add new content.${contextBlock}\n\nTEXT TO POLISH:\n\n${text}`;
    case "expand":
      return `Expand the following markdown with one or two more concrete sentences that stay on topic and match the author's voice. Don't pad. Keep the new sentences factual, not rhetorical.${contextBlock}\n\nTEXT TO EXPAND:\n\n${text}`;
    case "shorten":
      return `Tighten the following markdown by ~30%. Remove filler. Keep every concrete detail (numbers, names, tech terms). Keep voice.${contextBlock}\n\nTEXT TO SHORTEN:\n\n${text}`;
    case "rewrite":
      return `Rewrite the following markdown once in the author's voice. You may change phrasing and sentence structure but keep the meaning, facts, and tone.${contextBlock}\n\nTEXT TO REWRITE:\n\n${text}`;
    default:
      return text;
  }
}

export const AI_ACTION_LABELS: Record<AiAction, string> = {
  grammar: "fix grammar",
  polish: "polish",
  expand: "expand",
  shorten: "shorten",
  rewrite: "rewrite",
};

export const AI_ACTION_DESCRIPTIONS: Record<AiAction, string> = {
  grammar: "grammar, spelling, typos — keeps voice",
  polish: "light flow + clarity cleanup",
  expand: "adds 1-2 on-topic sentences",
  shorten: "trims ~30% without losing facts",
  rewrite: "one rewrite in your voice",
};

// Input size cap to avoid runaway calls.
export const AI_MAX_INPUT_CHARS = 8000;

/**
 * Expected output-length ratio per action. Used by the API route to detect
 * obviously-truncated free-model responses (e.g. a 2000-char rewrite coming
 * back as 200 chars because the model stopped early).
 *
 * Returned bounds are inclusive. If the output is outside [min, max] *and*
 * the input is long enough for the signal to be meaningful, the call is
 * treated as a bad response and the fallback chain continues to the next model.
 */
export function expectedLengthRatio(
  action: AiAction,
): { min: number; max: number } {
  switch (action) {
    case "shorten":
      return { min: 0.35, max: 0.95 };
    case "expand":
      return { min: 1.05, max: 3.0 };
    case "grammar":
      return { min: 0.8, max: 1.25 };
    case "polish":
      return { min: 0.7, max: 1.35 };
    case "rewrite":
      return { min: 0.6, max: 1.5 };
  }
}

/** input-length threshold below which ratio checks are skipped (too noisy) */
export const LENGTH_CHECK_MIN_INPUT = 150;
