#!/usr/bin/env node
/* eslint-disable */
/**
 * bootstrap first admin:
 *   npm run admin:create -- --username vain --password 'somepass' [--email vain@vainie.pl]
 *
 * idempotent: if the user already exists, it just promotes them to admin and
 * resets the password.
 *
 * supports both:
 *  - local sqlite (default; uses $DATA_DIR/vainie.db)
 *  - remote turso (set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
 */
const path = require("node:path");
const fs = require("node:fs");
const { createClient } = require("@libsql/client");
const argon = require("@node-rs/argon2");
const crypto = require("node:crypto");

// load .env.local
try {
  fs
    .readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    });
} catch {}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function makeClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (tursoUrl) {
    console.log(`[admin:create] using turso: ${tursoUrl.replace(/\/\/.*@/, "//***@")}`);
    return createClient({ url: tursoUrl, authToken: tursoToken });
  }
  const dataDir = process.env.DATA_DIR || "./data";
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "vainie.db");
  console.log(`[admin:create] using local sqlite: ${dbPath}`);
  return createClient({ url: `file:${dbPath}` });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const username = args.username;
  const password = args.password;
  const email = args.email || null;

  if (!username || !password) {
    console.error(
      "usage: npm run admin:create -- --username X --password Y [--email X]",
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("password must be at least 8 chars");
    process.exit(1);
  }
  if (!/^[a-zA-Z0-9_\-]{3,24}$/.test(username)) {
    console.error("username must be 3-24 chars, a-z 0-9 _ -");
    process.exit(1);
  }

  const db = makeClient();

  // ensure schema (simplified — just users table is enough for this)
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
  `;
  for (const stmt of ddl.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.execute(stmt);
  }

  const hash = await argon.hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  const existingRes = await db.execute({
    sql: "SELECT id FROM users WHERE username_lower = ?",
    args: [username.toLowerCase()],
  });
  const existing = existingRes.rows[0];

  if (existing) {
    await db.execute({
      sql: "UPDATE users SET password_hash = ?, role = 'admin', email = COALESCE(?, email) WHERE id = ?",
      args: [hash, email, existing.id],
    });
    console.log(`✔ updated existing user '${username}' → admin, password reset.`);
  } else {
    const id = crypto
      .randomBytes(16)
      .toString("base64url")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 21);
    await db.execute({
      sql: "INSERT INTO users (id, username, username_lower, email, password_hash, role) VALUES (?, ?, ?, ?, ?, 'admin')",
      args: [id, username, username.toLowerCase(), email, hash],
    });
    console.log(`✔ created admin user '${username}'.`);
  }

  if (typeof db.close === "function") {
    await db.close();
  }
  console.log(`done. you can now log in at /login with these credentials.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
