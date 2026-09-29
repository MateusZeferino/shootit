import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const secrets = ["SUPABASE_SERVICE_ROLE_KEY", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
  .map((name) => process.env[name]).filter(Boolean);
const directory = ".next/static";
if (secrets.length !== 3 || !existsSync(directory)) {
  throw new Error("Configure .env.local e execute npm run build antes desta verificação.");
}

function containsSecret(path) {
  return readdirSync(path, { withFileTypes: true }).some((entry) => {
    const itemPath = join(path, entry.name);
    return entry.isDirectory()
      ? containsSecret(itemPath)
      : secrets.some((secret) => readFileSync(itemPath).includes(secret));
  });
}

if (containsSecret(directory)) {
  throw new Error("Uma credencial de servidor foi encontrada no bundle do cliente.");
}
console.log("OK: credenciais de servidor ausentes do bundle do cliente.");
