import { describe, expect, it } from "vitest";

import { detectImageMimeType, photoExtension, validatePhotoFile } from "./validation";

describe("photo validation", () => {
  it("accepts the supported formats and rejects unsafe or oversized files", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(validatePhotoFile({ type: "image/png", size: 1024 })).toBeNull();
    expect(validatePhotoFile({ type: "image/webp", size: 1024 })).toBeNull();
    expect(validatePhotoFile({ type: "image/svg+xml", size: 1024 })).toMatch(/JPEG/);
    expect(validatePhotoFile({ type: "image/png", size: 0 })).toMatch(/vazio/);
    expect(validatePhotoFile({ type: "image/png", size: 10 * 1024 * 1024 + 1 })).toMatch(/10 MiB/);
    expect(photoExtension("image/jpeg")).toBe("jpg");
  });

  it("checks image signatures, not just MIME declarations", () => {
    expect(detectImageMimeType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(detectImageMimeType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(detectImageMimeType(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]))).toBe("image/webp");
    expect(detectImageMimeType(new TextEncoder().encode("<svg></svg>"))).toBeNull();
  });
});
