import { execSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { isKeychainReference, resolveKeychainSecret } from "./keychain.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, platform: vi.fn(() => "darwin") };
});

describe("keychain", () => {
  describe("isKeychainReference", () => {
    it("identifies keychain references", () => {
      expect(isKeychainReference("@keychain:openai")).toBe(true);
      expect(isKeychainReference("sk-123")).toBe(false);
      expect(isKeychainReference(undefined)).toBe(false);
    });
  });

  describe("resolveKeychainSecret", () => {
    it("returns plain strings as-is", () => {
      expect(resolveKeychainSecret("sk-123")).toBe("sk-123");
    });

    it("resolves @keychain reference via system command", () => {
      vi.mocked(execSync).mockReturnValue("real-api-key\n");

      const result = resolveKeychainSecret("@keychain:my-service");
      expect(result).toBe("real-api-key");
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("security find-generic-password -s 'my-service' -w"),
        expect.anything(),
      );
    });

    it("falls back to reference string if system command fails", () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("Not found");
      });

      const result = resolveKeychainSecret("@keychain:non-existent");
      expect(result).toBe("@keychain:non-existent");
    });
  });
});
