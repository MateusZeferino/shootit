"use client";

import { createBrowserClient } from "@supabase/ssr";

import { readPublicEnv } from "@/lib/env";

export function createClient() {
  const env = readPublicEnv();

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
