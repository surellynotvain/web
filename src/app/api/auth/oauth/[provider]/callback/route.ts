import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeAndFetchUser,
  type OAuthProvider,
} from "@/lib/oauth";
import {
  findOrCreateOAuthUser,
  createSession,
  setSessionCookie,
} from "@/lib/auth";

export const runtime = "nodejs";

function callbackUrl(provider: OAuthProvider) {
  const base = process.env.OAUTH_REDIRECT_BASE ?? "http://localhost:6967";
  return `${base}/api/auth/oauth/${provider}/callback`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (provider !== "github" && provider !== "microsoft") {
    return NextResponse.redirect(
      new URL("/login?error=bad-provider", req.url),
    );
  }

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(err)}`, req.url),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=missing-code", req.url));
  }

  const c = await cookies();
  const storedState = c.get("vainie_oauth_state")?.value;
  const storedProvider = c.get("vainie_oauth_provider")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL("/login?error=bad-state", req.url));
  }
  if (storedProvider !== provider) {
    return NextResponse.redirect(new URL("/login?error=provider-mismatch", req.url));
  }

  // clear state cookies
  c.delete("vainie_oauth_state");
  c.delete("vainie_oauth_provider");

  try {
    const profile = await exchangeCodeAndFetchUser(
      provider,
      code,
      callbackUrl(provider),
    );
    const user = await findOrCreateOAuthUser({
      provider,
      providerId: profile.id,
      username: profile.username,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
    });
    const sid = await createSession(user.id);
    await setSessionCookie(sid);
    return NextResponse.redirect(new URL("/", req.url));
  } catch (e) {
    console.error("oauth callback failed:", e);
    return NextResponse.redirect(
      new URL("/login?error=oauth-failed", req.url),
    );
  }
}
