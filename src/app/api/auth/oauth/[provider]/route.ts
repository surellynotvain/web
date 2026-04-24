import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildAuthUrl,
  isProviderConfigured,
  newOAuthState,
  type OAuthProvider,
} from "@/lib/oauth";

export const runtime = "nodejs";

function callbackUrl(provider: OAuthProvider) {
  const base = process.env.OAUTH_REDIRECT_BASE ?? "http://localhost:6967";
  return `${base}/api/auth/oauth/${provider}/callback`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (provider !== "github" && provider !== "microsoft") {
    return NextResponse.json({ error: "unknown provider" }, { status: 400 });
  }
  if (!isProviderConfigured(provider)) {
    return NextResponse.json(
      { error: `${provider} oauth not configured` },
      { status: 501 },
    );
  }

  const state = newOAuthState();
  const c = await cookies();
  c.set("vainie_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  c.set("vainie_oauth_provider", provider, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const url = buildAuthUrl(provider, state, callbackUrl(provider));
  return NextResponse.redirect(url, { status: 302 });
}
