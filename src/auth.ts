import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { withEncryptedTokens } from "@/server/encrypting-adapter";

/**
 * Auth.js v5 — Google sign-in that ALSO grants Gmail scopes, so the same
 * consent lets us send cold emails from the user's own inbox and detect
 * replies later (FEATURES.md F5/F7).
 *
 * - `access_type: "offline"` + `prompt: "consent"` → Google returns a
 *   refresh_token, stored on the Account row by the Prisma adapter.
 * - Database sessions (not JWT): revocable, and the session callback can
 *   expose `user.id` for services.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: withEncryptedTokens(PrismaAdapter(db)),
  secret: env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.readonly",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      // expose the DB user id to server code
      session.user.id = user.id;
      return session;
    },
  },
});
