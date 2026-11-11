// Shared Prisma client (Postgres via the pg driver adapter). Reused across dev hot reloads.
import "./env.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const globalForPrisma = globalThis as { prisma?: PrismaClient };

export const prisma = (globalForPrisma.prisma ??= new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
}));
