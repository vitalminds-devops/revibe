// Admin accounts, shared by server start-up (auth-setup.ts) and `npm run auth:*` (scripts/auth.ts).
// Goes through Better Auth's adapter (not Prisma directly) so passwords are hashed its way.
import { auth } from "./auth.ts";

export const MIN_PASSWORD = 8;

/** Creates the admin, or sets a new password if the email already exists. */
export async function upsertAdmin(
  rawEmail: string,
  password: string,
): Promise<"created" | "updated" | "unchanged"> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error(`"${rawEmail}" is not a valid email address`);
  if (password.length < MIN_PASSWORD)
    throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);

  const ctx = await auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(email, {
    includeAccounts: true,
  });
  if (!found) {
    const user = await ctx.internalAdapter.createUser(
      { email, name: email.split("@")[0], emailVerified: true },
      { method: "admin" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await ctx.password.hash(password),
    });
    return "created";
  }
  const credential = found.accounts.find((a) => a.providerId === "credential");
  if (!credential) {
    await ctx.internalAdapter.linkAccount({
      userId: found.user.id,
      providerId: "credential",
      accountId: found.user.id,
      password: await ctx.password.hash(password),
    });
    return "updated";
  }
  if (
    credential.password &&
    (await ctx.password.verify({ password, hash: credential.password }))
  )
    return "unchanged";
  await ctx.internalAdapter.updatePassword(
    found.user.id,
    await ctx.password.hash(password),
  );
  return "updated";
}

export async function listAdmins() {
  const ctx = await auth.$context;
  const users = await ctx.internalAdapter.listUsers(undefined, undefined, {
    field: "createdAt",
    direction: "asc",
  });
  return users.map((u) => ({ email: u.email, createdAt: u.createdAt }));
}

/** Deletes the admin and signs them out everywhere. Refuses to remove the last one. */
export async function removeAdmin(rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  const ctx = await auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(email);
  if (!found) throw new Error(`No admin with email ${email}`);
  if ((await ctx.internalAdapter.countTotalUsers()) <= 1)
    throw new Error("Can't remove the last admin; add another one first");
  await ctx.internalAdapter.deleteUserSessions(found.user.id);
  await ctx.internalAdapter.deleteAccounts(found.user.id);
  await ctx.internalAdapter.deleteUser(found.user.id);
}
