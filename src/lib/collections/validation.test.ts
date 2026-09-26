import { describe, expect, it } from "vitest";

import {
  collectionIdSchema,
  collectionNameSchema,
} from "@/lib/collections/validation";

describe("collection validation", () => {
  it("trims a valid name", () => {
    expect(collectionNameSchema.parse("  Ensaio de família  ")).toBe("Ensaio de família");
  });

  it("rejects empty and oversized names", () => {
    expect(collectionNameSchema.safeParse("   ").success).toBe(false);
    expect(collectionNameSchema.safeParse("x".repeat(121)).success).toBe(false);
  });

  it("accepts UUIDs and rejects arbitrary route identifiers", () => {
    expect(collectionIdSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
    expect(collectionIdSchema.safeParse("../outro-usuario").success).toBe(false);
  });
});
