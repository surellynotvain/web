import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const DB_PATH = path.join(DATA_DIR, "vainie.db");

// make sure the data dir exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// singleton — important across hot reloads
const globalForDb = globalThis as unknown as {
  __sqlite?: Database.Database;
};

const sqlite =
  globalForDb.__sqlite ??
  new Database(DB_PATH, {
    // readonly: false (default)
  });

globalForDb.__sqlite = sqlite;

// performance + safety pragmas
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });

// --- minimal migration runner ---
// we keep schema-driven migrations in a tiny in-code fashion to avoid needing
// a separate drizzle-kit push at runtime. this idempotently creates the tables
// if they don't exist.
function runMigrations() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      username_lower TEXT NOT NULL,
      email TEXT,
      password_hash TEXT,
      oauth_provider TEXT,
      oauth_id TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      avatar_url TEXT,
      allow_ai_training INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users(username_lower);
    CREATE UNIQUE INDEX IF NOT EXISTS users_oauth_idx ON users(oauth_provider, oauth_id) WHERE oauth_provider IS NOT NULL;
    CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      excerpt TEXT,
      content TEXT NOT NULL,
      cover_url TEXT,
      author_id TEXT NOT NULL REFERENCES users(id),
      published INTEGER NOT NULL DEFAULT 0,
      published_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS posts_slug_idx ON posts(slug);
    CREATE INDEX IF NOT EXISTS posts_published_idx ON posts(published, published_at);

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT,
      content TEXT NOT NULL,
      hidden INTEGER NOT NULL DEFAULT 0,
      ip_hash TEXT,
      allow_ai_training INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS comments_post_idx ON comments(post_id, created_at);

    CREATE TABLE IF NOT EXISTS likes (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      cookie_id TEXT,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS likes_cookie_idx ON likes(post_id, cookie_id) WHERE cookie_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS likes_user_idx ON likes(post_id, user_id) WHERE user_id IS NOT NULL;
  `);

  // --- additive ALTERs for existing databases ---
  // these are idempotent: we only add a column if it doesn't already exist.
  ensureColumn("users", "allow_ai_training", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("comments", "allow_ai_training", "INTEGER NOT NULL DEFAULT 0");
}

function ensureColumn(table: string, column: string, definition: string) {
  try {
    const rows = sqlite
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>;
    if (rows.some((r) => r.name === column)) return;
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch (err) {
    console.warn(`[db] ensureColumn ${table}.${column} failed`, err);
  }
}

const globalForMigrations = globalThis as unknown as { __migrated?: boolean };
if (!globalForMigrations.__migrated) {
  runMigrations();
  globalForMigrations.__migrated = true;
}

// expose raw sqlite db for advanced queries if needed
export { sqlite };
export { sql };
