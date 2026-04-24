import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

// URL-safe ID generator (nanoid-ish)
export function newId(bytes = 16): string {
  return randomBytes(bytes)
    .toString("base64url")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 21);
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.SESSION_SECRET || "fallback-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
