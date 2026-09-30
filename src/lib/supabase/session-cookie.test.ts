import { describe, expect, it } from "vitest";

import { persistentSessionCookieOptions, SESSION_COOKIE_MAX_AGE_SECONDS } from "@/lib/supabase/session-cookie";

describe("session cookie", () => {
  it("persists a newly issued auth cookie for seven days", () => {
    expect(persistentSessionCookieOptions({ path: "/", maxAge: 400 * 24 * 60 * 60 })).toEqual({
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
  });

  it("does not make a cleared cookie persistent again", () => {
    expect(persistentSessionCookieOptions({ path: "/", maxAge: 0 })).toEqual({
      path: "/",
      maxAge: 0,
    });
  });
});
