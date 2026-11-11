// Runs at server start and in `npm run auth:provision`: checks settings, then syncs the optional
// env admin. Tables come from Prisma migrations (`npm run db:migrate`, run before dev/start).
import { upsertAdmin } from "./admins.ts";
import { prisma } from "./prisma.ts";

export async function setupAuth() {
  const missing = ["DATABASE_URL", "BETTER_AUTH_SECRET"].filter(
    (name) => !process.env[name],
  );
  if (missing.length)
    throw new Error(
      `Fill in ${missing.join(", ")} in .env at the repo root (see .env.example)`,
    );
  if (process.env.BETTER_AUTH_SECRET!.length < 32)
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");

  const [{ ready }] = await prisma.$queryRaw<{ ready: boolean }[]>`
    select to_regclass('public."user"') is not null as ready`;
  if (!ready)
    throw new Error(
      "Database tables are missing. Run `npm run db:migrate` in frontend/.",
    );

  // Optional: more admins are added with `npm run auth:provision admin`.
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  const result = await upsertAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (result !== "unchanged")
    console.log(`[auth] Admin ${ADMIN_EMAIL} ${result} from .env`);
}
