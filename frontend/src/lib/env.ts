// One settings file for the whole app: the repo-root .env (run from frontend/).
// Values already set (shell, or frontend/.env.local loaded by Next) win over it.
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), "../.env"), quiet: true });
