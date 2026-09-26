import { describe, expect, it } from "vitest";
import { z } from "zod";

import { signInSchema, signUpSchema } from "@/lib/auth/validation";

describe("auth validation", () => {
  it("accepts a valid sign-up and trims display name and email", () => {
    const result = signUpSchema.parse({
      name: "  Ana Silva  ",
      email: "  ana@example.com  ",
      password: "uma-senha-segura",
    });

    expect(result.name).toBe("Ana Silva");
    expect(result.email).toBe("ana@example.com");
  });

  it("rejects invalid sign-up fields", () => {
    const result = signUpSchema.safeParse({
      name: " ",
      email: "inválido",
      password: "curta",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = z.flattenError(result.error).fieldErrors;
      expect(fields.name).toBeDefined();
      expect(fields.email).toBeDefined();
      expect(fields.password).toBeDefined();
    }
  });

  it("rejects an empty password at login", () => {
    expect(signInSchema.safeParse({ email: "ana@example.com", password: "" }).success).toBe(false);
  });
});
