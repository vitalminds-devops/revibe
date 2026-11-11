export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { setupAuth } = await import("./lib/auth-setup");
  await setupAuth();
}
