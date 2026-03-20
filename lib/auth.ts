import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  login: z.string().min(1),   // accepts username or email
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Required behind Railway / Vercel proxies so Auth.js trusts `Host` / forwarded URL.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        login: { label: "Username or Email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const login = parsed.data.login.trim();
        const { password } = parsed.data;
        if (!login) return null;

        // Find by email or username
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: login.toLowerCase() },
              { username: { equals: login, mode: "insensitive" } },
            ],
          },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Update last active
        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.displayName ?? user.username ?? "",
          username: user.username,
          tier: user.tier,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? "";
        token.username = (user as { username: string }).username;
        token.tier = (user as { tier: string }).tier;
        token.isAdmin = (user as { isAdmin: boolean }).isAdmin;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.username = token.username as string;
      session.user.tier = token.tier as string;
      session.user.isAdmin = token.isAdmin as boolean;
      return session;
    },
  },
});
