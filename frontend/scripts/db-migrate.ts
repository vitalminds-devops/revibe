// `npm run db:migrate`: apply pending Prisma migrations (runs before `npm run dev` / `npm start`).
// A database created before Prisma (tables exist, no migration history) makes `migrate deploy`
// fail with P3005; 0_init is written to be safe on such a database, so we apply it and record
// it as the baseline, then deploy the rest.
import { spawnSync } from "node:child_process";

function prisma(args: string, quiet = false) {
  const result = spawnSync(`npx prisma ${args}`, {
    shell: true,
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (!quiet || result.status !== 0) process.stdout.write(output);
  return { ok: result.status === 0, output };
}

let deploy = prisma("migrate deploy", true);
if (!deploy.ok && deploy.output.includes("P3005")) {
  console.log(
    "Existing database without Prisma history: applying 0_init (safe on existing tables) as the baseline.",
  );
  const steps = [
    "db execute --file prisma/migrations/0_init/migration.sql",
    "migrate resolve --applied 0_init",
  ];
  for (const step of steps) if (!prisma(step).ok) process.exit(1);
  deploy = prisma("migrate deploy", true);
}
if (!deploy.ok) process.exit(1);
console.log("Database is up to date.");
