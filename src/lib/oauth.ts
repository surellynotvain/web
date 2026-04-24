import "server-only";
import { newId } from "@/lib/crypto";

export type OAuthProvider = "github" | "microsoft";

// Shape of the bits of the GitHub /user response we actually read.
type GithubUser = {
  id: number | string;
  login?: string;
  email?: string | null;
  avatar_url?: string | null;
};

// Shape of the bits of Microsoft Graph /me we actually read.
type MicrosoftUser = {
  id: string;
  userPrincipalName?: string;
  displayName?: string;
  mail?: string | null;
};

type ProviderConfig<T = unknown> = {
  authUrl: string;
  tokenUrl: string;
  userUrl: string;
  scope: string;
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
  parseUser: (data: T, token: string) => Promise<{
    id: string;
    username: string;
    email: string | null;
    avatarUrl: string | null;
  }>;
};

const providers: {
  github: ProviderConfig<GithubUser>;
  microsoft: ProviderConfig<MicrosoftUser>;
} = {
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userUrl: "https://api.github.com/user",
    scope: "read:user user:email",
    clientId: () => process.env.GITHUB_CLIENT_ID,
    clientSecret: () => process.env.GITHUB_CLIENT_SECRET,
    parseUser: async (u, token) => {
      let email: string | null = u.email ?? null;
      if (!email) {
        const res = await fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${token}`, "User-Agent": "vainie" },
        });
        if (res.ok) {
          const list = (await res.json()) as {
            email: string;
            primary: boolean;
            verified: boolean;
          }[];
          const primary = list.find((x) => x.primary && x.verified);
          if (primary) email = primary.email;
        }
      }
      return {
        id: String(u.id),
        username: u.login ?? `gh_${u.id}`,
        email,
        avatarUrl: u.avatar_url ?? null,
      };
    },
  },
  microsoft: {
    authUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userUrl: "https://graph.microsoft.com/v1.0/me",
    scope: "User.Read email openid profile offline_access",
    clientId: () => process.env.MICROSOFT_CLIENT_ID,
    clientSecret: () => process.env.MICROSOFT_CLIENT_SECRET,
    parseUser: async (u) => ({
      id: String(u.id),
      username:
        u.userPrincipalName?.split("@")[0] ??
        u.displayName ??
        `ms_${u.id}`,
      email: u.mail ?? u.userPrincipalName ?? null,
      avatarUrl: null,
    }),
  },
};

export function isProviderConfigured(p: OAuthProvider): boolean {
  const cfg = providers[p];
  return Boolean(cfg.clientId() && cfg.clientSecret());
}

export function listConfiguredProviders(): OAuthProvider[] {
  return (Object.keys(providers) as OAuthProvider[]).filter(
    isProviderConfigured,
  );
}

export function buildAuthUrl(
  provider: OAuthProvider,
  state: string,
  redirectUri: string,
): string {
  const cfg = providers[provider];
  const params = new URLSearchParams({
    client_id: cfg.clientId()!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: cfg.scope,
    state,
  });
  return `${cfg.authUrl}?${params.toString()}`;
}

export function newOAuthState(): string {
  return newId(24);
}

export async function exchangeCodeAndFetchUser(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
): Promise<{
  id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
}> {
  const cfg = providers[provider];
  const clientId = cfg.clientId()!;
  const clientSecret = cfg.clientSecret()!;

  // 1) exchange code for token
  const tokRes = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokRes.ok) {
    throw new Error(`oauth token exchange failed: ${tokRes.status}`);
  }
  const tokData = (await tokRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokData.access_token) {
    throw new Error(tokData.error_description ?? "no access_token returned");
  }

  // 2) fetch user profile
  const userRes = await fetch(cfg.userUrl, {
    headers: {
      Authorization: `Bearer ${tokData.access_token}`,
      Accept: "application/json",
      "User-Agent": "vainie",
    },
  });
  if (!userRes.ok) {
    throw new Error(`oauth user fetch failed: ${userRes.status}`);
  }
  const userJson = await userRes.json();

  // each provider's parseUser is typed to its own user shape; safe cast here
  // because the URL / token pairing guarantees the response shape.
  if (provider === "github") {
    return providers.github.parseUser(userJson as GithubUser, tokData.access_token);
  }
  return providers.microsoft.parseUser(userJson as MicrosoftUser, tokData.access_token);
}
