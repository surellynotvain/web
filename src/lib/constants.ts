// centralized constants. values that used to be magic numbers scattered
// across files live here so they're easy to tweak in one place.

export const BLOG_PAGE_SIZE = 20;
export const ADMIN_PAGE_SIZE = 30;
export const COMMENTS_PAGE_SIZE = 50;

export const COMMENT_CHAR_LIMIT = 2000;
export const COMMENT_NAME_LIMIT = 40;
export const POST_EXCERPT_LIMIT = 280;

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// words-per-minute for reading-time estimates
export const WORDS_PER_MINUTE = 220;
