import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const directory = ".next/static";
if (!secret || !existsSync(directory)) {
  throw new Error("Configure .env.local e execute npm run build antes desta verificação.");
}

function containsSecret(path) {
  return readdirSync(path, { withFileTypes: true }).some((entry) => {
    const itemPath = join(path, entry.name);
    return entry.isDirectory()
      ? containsSecret(itemPath)
      : readFileSync(itemPath).includes(secret);
  });
}

if (containsSecret(directory)) {
  throw new Error("A chave administrativa foi encontrada no bundle do cliente.");
}
console.log("OK: chave administrativa ausente do bundle do cliente.");
