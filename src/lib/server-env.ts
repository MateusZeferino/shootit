import "server-only";

import { parseServerEnv, readPublicEnv, type ServerEnv } from "@/lib/env";

export function readServerEnv(): ServerEnv {
  return parseServerEnv({
    ...readPublicEnv(),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
