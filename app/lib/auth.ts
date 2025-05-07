import { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { storeUser } from "@/app/lib/db";
import { getServerSession } from "next-auth/next";

export const authOptions: NextAuthOptions = {
  providers: process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' ? [
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
      authorization: {
        url: `${process.env.OAUTH_GITHUB_ENTERPRISE_URL}/login/oauth/authorize`,
        params: { scope: "read:user user:email" }
      },
      token: {
        url: `${process.env.OAUTH_GITHUB_ENTERPRISE_URL}/login/oauth/access_token`,
        async request({ params, provider }) {
          const response = await fetch(`${process.env.OAUTH_GITHUB_ENTERPRISE_URL}/login/oauth/access_token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              client_id: provider.clientId,
              client_secret: provider.clientSecret,
              code: params.code,
              redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/github`,
            }),
          });
          const tokens = await response.json();
          return { tokens };
        }
      },
      userinfo: {
        url: `${process.env.OAUTH_GITHUB_ENTERPRISE_URL}/api/v3/user`,
        async request({ tokens }) {
          return await fetch(`${process.env.OAUTH_GITHUB_ENTERPRISE_URL}/api/v3/user`, {
            headers: {
              Authorization: `token ${tokens.access_token}`,
              'User-Agent': 'QueryCraft',
              Accept: 'application/vnd.github.v3+json'
            },
          }).then(async (res) => {
            if (!res.ok) {
              const error = await res.text();
              throw new Error(`Failed to fetch user info: ${error}`);
            }
            return await res.json();
          });
        }
      },
    }),
  ] : [],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'github' && profile) {
        await storeUser({
          id: user.id,
          name: user.name || null,
          email: user.email || null,
          image: user.image || null,
          githubId: (profile as any).id?.toString() || user.id,
        });
      }
      return true;
    },
    async session({ session, token }) {
      if (session?.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  debug: process.env.NODE_ENV === 'development',
};

export async function checkUserSession() {
  if (process.env.NEXT_PUBLIC_ENABLE_OAUTH !== 'true') {
    return {
      isAuthenticated: true,
      userId: 'anonymous'
    };
  }
  
  const session = await getServerSession(authOptions);
  return {
    isAuthenticated: !!session?.user?.id,
    userId: session?.user?.id
  };
} 