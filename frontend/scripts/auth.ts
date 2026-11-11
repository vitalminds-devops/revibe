// Login provisioning from the terminal (run in frontend/):
//   npm run auth:provision              create/update the login tables (+ the optional env admin)
//   npm run auth:provision admin        same, then ask for an email + password and create that admin;
//                                       re-run with the same email to change the password
//   npm run auth:list                   list admins
//   npm run auth:remove you@example.com remove an admin and sign them out
// Reads DATABASE_URL and BETTER_AUTH_SECRET from the repo-root .env, like the website.
import {
  listAdmins,
  MIN_PASSWORD,
  removeAdmin,
  upsertAdmin,
} from "../src/lib/admins.ts";
import { setupAuth } from "../src/lib/auth-setup.ts";

const stdin = process.stdin;
// Piped input (e.g. in CI): answers are read line by line instead of typed.
const piped: Promise<string[]> | null = stdin.isTTY
  ? null
  : new Promise((resolve) => {
      let data = "";
      stdin.on("data", (chunk) => (data += chunk));
      stdin.on("end", () => resolve(data.split(/\r?\n/)));
    });

/** Prompts for one line; `hidden` keeps passwords off screen and out of shell history. */
async function ask(question: string, hidden = false): Promise<string> {
  process.stdout.write(question);
  if (piped) {
    const line = (await piped).shift() ?? "";
    process.stdout.write("\n");
    return line;
  }
  return new Promise((resolve, reject) => {
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const done = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
    };
    const onData = (key: string) => {
      for (const ch of key) {
        if (ch === "\r" || ch === "\n") return (done(), resolve(value.trim()));
        if (ch === "\u0003") return (done(), reject(new Error("Cancelled")));
        if (ch === "\u007f" || ch === "\b") {
          if (value && !hidden) process.stdout.write("\b \b");
          value = value.slice(0, -1);
        } else {
          value += ch;
          if (!hidden) process.stdout.write(ch);
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function provisionAdmin(emailArg?: string) {
  const email = emailArg ?? (await ask("Admin email: "));
  const password = await ask(`Password (${MIN_PASSWORD}+ characters): `, true);
  if (!piped && (await ask("Repeat password: ", true)) !== password)
    throw new Error("Passwords don't match");
  const result = await upsertAdmin(email, password);
  console.log(
    result === "created"
      ? `Admin ${email} created. They can sign in now.`
      : result === "updated"
        ? `Password updated for ${email}.`
        : `${email} already has that password.`,
  );
}

async function main() {
  const [command, target, email] = process.argv.slice(2);
  if (command === "provision" && (!target || target === "admin")) {
    await setupAuth(); // checks .env, creates the tables, syncs the env admin
    console.log("Login tables are ready.");
    if (target === "admin") await provisionAdmin(email);
  } else if (command === "list") {
    await setupAuth();
    const admins = await listAdmins();
    if (!admins.length)
      console.log("No admins yet. Add one: npm run auth:provision admin");
    for (const a of admins)
      console.log(`${a.email}  (added ${a.createdAt.toLocaleDateString()})`);
  } else if (command === "remove" && target) {
    await setupAuth();
    await removeAdmin(target);
    console.log(`Admin ${target} removed and signed out.`);
  } else {
    console.log(
      "Usage:\n  npm run auth:provision\n  npm run auth:provision admin [email]\n  npm run auth:list\n  npm run auth:remove <email>",
    );
    process.exitCode = 1;
  }
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  },
);
