import "server-only";
import { cookies, headers } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { hash, verify } from "@node-rs/argon2";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { newId, sha256 } from "@/lib/crypto";
import type { User } from "@/lib/db/schema";

const SESSION_COOKIE = "vainie_sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LIKE_COOKIE = "vainie_cid";

// ---------- passwords ----------

export async function hashPassword(pw: string): Promise<string> {
  return hash(pw, {
    memoryCost: 19_456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}

export async function verifyPassword(
  pw: string,
  stored: string,
): Promise<boolean> {
  try {
    return await verify(stored, pw);
  } catch {
    return false;
  }
}

// ---------- sessions ----------

export async function createSession(userId: string): Promise<string> {
  const id = newId(24);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return id;
}

export async function deleteSession(id: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, id));
}

async function getSession(id: string) {
  const [row] = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function setSessionCookie(sessionId: string): Promise<void> {
  const c = await cookies();
  c.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const c = await cookies();
  const sid = c.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const row = await getSession(sid);
  return row?.user ?? null;
}

export async function requireAdmin(): Promise<User> {
  const u = await getCurrentUser();
  if (!u || u.role !== "admin") {
    throw new Error("unauthorized");
  }
  return u;
}

// ---------- anon like-cookie ----------

// Returns existing like-cookie id, or null if not set.
// (Cannot be created in a page render context.)
export async function readCookieId(): Promise<string | null> {
  const c = await cookies();
  const existing = c.get(LIKE_COOKIE)?.value;
  return existing && existing.length >= 16 ? existing : null;
}

// Returns existing id, or creates and persists a fresh one.
// MUST only be called from Route Handlers / Server Actions.
export async function getOrCreateCookieId(): Promise<string> {
  const c = await cookies();
  const existing = c.get(LIKE_COOKIE)?.value;
  if (existing && existing.length >= 16) return existing;
  const fresh = newId(16);
  c.set(LIKE_COOKIE, fresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2, // 2 years
  });
  return fresh;
}

// ---------- request metadata ----------

export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

// ---------- user signup ----------

export async function createUserWithPassword(opts: {
  username: string;
  email?: string | null;
  password: string;
  role?: "admin" | "user";
}): Promise<User> {
  const username = opts.username.trim();
  if (!/^[a-zA-Z0-9_\-]{3,24}$/.test(username)) {
    throw new Error("username must be 3–24 chars, a-z 0-9 _ -");
  }
  if (opts.password.length < 8) {
    throw new Error("password must be at least 8 chars");
  }
  const passwordHash = await hashPassword(opts.password);
  const id = newId();
  const [row] = await db
    .insert(users)
    .values({
      id,
      username,
      usernameLower: username.toLowerCase(),
      email: opts.email ?? null,
      passwordHash,
      role: opts.role ?? "user",
    })
    .returning();
  return row;
}

export async function authenticateByPassword(
  usernameOrEmail: string,
  password: string,
): Promise<User | null> {
  const key = usernameOrEmail.trim().toLowerCase();
  // try username first, then email
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.usernameLower, key))
    .limit(1);
  if (!user) {
    [user] = await db.select().from(users).where(eq(users.email, key)).limit(1);
  }
  if (!user || !user.passwordHash) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}

// ---------- oauth (shared helpers) ----------

export async function findOrCreateOAuthUser(params: {
  provider: "github" | "microsoft";
  providerId: string;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
}): Promise<User> {
  const [existing] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.oauthProvider, params.provider),
        eq(users.oauthId, params.providerId),
      ),
    )
    .limit(1);
  if (existing) return existing;

  // deduplicate username if taken
  const username = params.username.replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 20) || "user";
  let attempt = username;
  let n = 0;
  while (true) {
    const [clash] = await db
      .select()
      .from(users)
      .where(eq(users.usernameLower, attempt.toLowerCase()))
      .limit(1);
    if (!clash) break;
    n += 1;
    attempt = `${username}${n}`;
    if (n > 1000) throw new Error("could not allocate username");
  }

  const id = newId();
  const [row] = await db
    .insert(users)
    .values({
      id,
      username: attempt,
      usernameLower: attempt.toLowerCase(),
      email: params.email ?? null,
      oauthProvider: params.provider,
      oauthId: params.providerId,
      avatarUrl: params.avatarUrl ?? null,
      passwordHash: null,
      role: "user",
    })
    .returning();
  return row;
}

// ---------- csrf ----------

// synchronizer-token csrf.
// in page renders, we can only *read* cookies (not set them), so we use a
// deterministic token derived from the SESSION_SECRET + session id (or a
// per-request random if no session). writes happen on first navigation
// via a route handler.
export async function generateCsrfToken(): Promise<string> {
  const c = await cookies();
  const existing = c.get("vainie_csrf")?.value;
  if (existing && existing.length >= 16) return existing;

  // can't set cookie in pages. return an ephemeral token that the
  // /api/csrf endpoint will persist on first user interaction.
  // we compute a stable-ish token from the current session id (if any) so
  // login/logout forms work on the very first visit.
  const sessionId = c.get(SESSION_COOKIE)?.value ?? "";
  const secret = process.env.SESSION_SECRET ?? "fallback-secret";
  const pre = sha256(`${secret}:${sessionId}`).slice(0, 32);
  return pre;
}

export async function ensureCsrfCookie(): Promise<string> {
  const c = await cookies();
  const existing = c.get("vainie_csrf")?.value;
  if (existing && existing.length >= 16) return existing;

  const sessionId = c.get(SESSION_COOKIE)?.value ?? "";
  const secret = process.env.SESSION_SECRET ?? "fallback-secret";
  const token = sha256(`${secret}:${sessionId}:${newId(8)}`).slice(0, 40);
  c.set("vainie_csrf", token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return token;
}

export async function verifyCsrfToken(submitted: string): Promise<boolean> {
  if (!submitted || typeof submitted !== "string") return false;
  const c = await cookies();
  const real = c.get("vainie_csrf")?.value;

  // accept either:
  //   a) the real cookie value (normal case)
  //   b) the deterministic pre-cookie token (first visit, no cookie yet)
  if (real && real === submitted) return true;

  const sessionId = c.get(SESSION_COOKIE)?.value ?? "";
  const secret = process.env.SESSION_SECRET ?? "fallback-secret";
  const pre = sha256(`${secret}:${sessionId}`).slice(0, 32);
  return submitted === pre;
}

export { SESSION_COOKIE, SESSION_TTL_MS, LIKE_COOKIE };
