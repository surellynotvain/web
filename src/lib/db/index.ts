import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import path from "node:path";
import fs from "node:fs";

// ---------- connection resolution ----------
// - prefer TURSO_DATABASE_URL + TURSO_AUTH_TOKEN if set (remote / serverless)
// - fall back to local sqlite file at $DATA_DIR/vainie.db
// both work identically since libsql is sqlite-compatible.

const DATA_DIR = process.env.DATA_DIR || "./data";
const LOCAL_DB_PATH = path.join(DATA_DIR, "vainie.db");

const TURSO_URL = process.env.TURSO_DATABASE_URL?.trim();
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN?.trim();

function makeClient(): Client {
  if (TURSO_URL) {
    return createClient({
      url: TURSO_URL,
      authToken: TURSO_TOKEN,
    });
  }
  // local mode: file URL. ensure the directory exists first.
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  return createClient({
    url: `file:${LOCAL_DB_PATH}`,
  });
}

// singleton — survives hot reloads in dev
const globalForDb = globalThis as unknown as {
  __libsql?: Client;
};

const client = globalForDb.__libsql ?? makeClient();
globalForDb.__libsql = client;

export const db = drizzle(client, { schema });

// ---------- minimal migration runner ----------
// we keep schema-driven migrations in a tiny in-code fashion to avoid needing
// a separate drizzle-kit push at runtime. idempotent CREATE TABLE IF NOT EXISTS
// for the initial schema, plus ALTER TABLE for additive columns on older dbs.

async function runMigrations() {
  // NOTE: libsql's batch() takes an array of statements; splitting by ';'
  // and filtering empties keeps the source readable.
  const ddl = `
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
  `;

  const stmts = ddl
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of stmts) {
    await client.execute(stmt);
  }

  // pragmas — only applicable to local sqlite; Turso manages its own.
  if (!TURSO_URL) {
    try {
      await client.execute("PRAGMA journal_mode = WAL");
      await client.execute("PRAGMA synchronous = NORMAL");
      await client.execute("PRAGMA foreign_keys = ON");
      await client.execute("PRAGMA busy_timeout = 5000");
    } catch (err) {
      console.warn("[db] pragma setup failed (non-fatal)", err);
    }
  }

  // additive ALTERs for existing databases
  await ensureColumn("users", "allow_ai_training", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("comments", "allow_ai_training", "INTEGER NOT NULL DEFAULT 0");
}

async function ensureColumn(
  table: string,
  column: string,
  definition: string,
) {
  try {
    const result = await client.execute(`PRAGMA table_info(${table})`);
    const cols = result.rows.map((r) => String(r.name));
    if (cols.includes(column)) return;
    await client.execute(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
    );
  } catch (err) {
    console.warn(`[db] ensureColumn ${table}.${column} failed`, err);
  }
}

// migrations run once per server process
const globalForMigrations = globalThis as unknown as { __migrated?: boolean };
if (!globalForMigrations.__migrated) {
  globalForMigrations.__migrated = true;
  // fire and forget; any error is logged. queries will throw if tables are
  // genuinely missing, so failures surface quickly.
  runMigrations().catch((err) => {
    console.error("[db] migrations failed", err);
    globalForMigrations.__migrated = false;
  });
}

// re-export sql helper for callers that import from this module
export { sql };
// expose the raw client for rare cases that need it (e.g. admin scripts)
export { client as sqlite };
