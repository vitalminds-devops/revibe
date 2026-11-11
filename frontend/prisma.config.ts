// Prisma CLI config. DATABASE_URL comes from the repo-root .env, the app's single settings file.
import "./src/lib/env.ts";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
});
