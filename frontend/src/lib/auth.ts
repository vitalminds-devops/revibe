// Server-side Better Auth instance. Email + password only, no sign-up: admins are provisioned
// with `npm run auth:provision admin`. Tables come from Prisma migrations (prisma/).
import "./env.ts"; // must load before Better Auth reads process.env
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.ts";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Deployed: APP_URL is the public address (https:// gives secure cookies).
  // Local/LAN: any of AUTH_ALLOWED_HOSTS over plain HTTP, e.g. "localhost:3000,192.168.1.20:3000".
  baseURL: process.env.APP_URL || {
    allowedHosts: (process.env.AUTH_ALLOWED_HOSTS ?? "localhost:3000")
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean),
    protocol: "http",
  },
  emailAndPassword: { enabled: true, disableSignUp: true },
  session: { expiresIn: 60 * 60 * 24 * 7 },
});
