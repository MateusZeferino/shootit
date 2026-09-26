import { describe, expect, it } from "vitest";

import { parsePublicEnv, parseServerEnv } from "@/lib/env";

const validPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

describe("environment validation", () => {
  it("accepts a valid public configuration", () => {
    expect(parsePublicEnv(validPublicEnv)).toEqual(validPublicEnv);
  });

  it("rejects an invalid Supabase URL with a clear message", () => {
    expect(() =>
      parsePublicEnv({
        ...validPublicEnv,
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL deve ser uma URL válida");
  });

  it("requires the service role key only on the server", () => {
    expect(() => parseServerEnv(validPublicEnv)).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY não foi definida",
    );
  });
});
