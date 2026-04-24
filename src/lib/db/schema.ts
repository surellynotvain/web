import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------- users ----------
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // nanoid-style
    username: text("username").notNull(),
    usernameLower: text("username_lower").notNull(),
    email: text("email"),
    passwordHash: text("password_hash"), // null for oauth-only accounts
    oauthProvider: text("oauth_provider"), // 'github' | 'microsoft' | null
    oauthId: text("oauth_id"),
    role: text("role", { enum: ["admin", "user"] })
      .notNull()
      .default("user"),
    avatarUrl: text("avatar_url"),
    // opt-in: let *future* comments this user writes be used for ai training.
    // explicit per-comment checkbox always wins over this global flag.
    allowAiTraining: integer("allow_ai_training", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    usernameLowerIdx: uniqueIndex("users_username_lower_idx").on(t.usernameLower),
    oauthIdx: uniqueIndex("users_oauth_idx").on(t.oauthProvider, t.oauthId),
    emailIdx: index("users_email_idx").on(t.email),
  }),
);

// ---------- sessions ----------
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// ---------- posts ----------
export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    content: text("content").notNull(), // markdown
    coverUrl: text("cover_url"),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(false),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    slugIdx: uniqueIndex("posts_slug_idx").on(t.slug),
    publishedIdx: index("posts_published_idx").on(t.published, t.publishedAt),
  }),
);

// ---------- comments ----------
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    // either userId OR authorName (anon) is set
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name"), // for anon
    content: text("content").notNull(),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    ipHash: text("ip_hash"), // for rate limiting / abuse
    // per-comment opt-in consent snapshot. true only if the commenter
    // explicitly ticked the box at submission time.
    allowAiTraining: integer("allow_ai_training", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    postIdx: index("comments_post_idx").on(t.postId, t.createdAt),
  }),
);

// ---------- likes ----------
export const likes = sqliteTable(
  "likes",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    // cookieId for anon, or userId for logged-in
    cookieId: text("cookie_id"),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    cookieLikeIdx: uniqueIndex("likes_cookie_idx").on(t.postId, t.cookieId),
    userLikeIdx: uniqueIndex("likes_user_idx").on(t.postId, t.userId),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type Like = typeof likes.$inferSelect;
