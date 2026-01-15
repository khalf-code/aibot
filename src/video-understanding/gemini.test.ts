import fs from "node:fs/promises";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { describeVideoViaGemini } from "./gemini.js";

// Mock fs and fetch
vi.mock("node:fs/promises");

describe("describeVideoViaGemini", () => {
  const mockApiKey = "test-api-key";
  const mockFilePath = "/tmp/test-video.mp4";

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock file reading
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("fake video data"));
    // Clear any existing fetch mocks
    vi.unstubAllGlobals();
  });

  describe("successful video description", () => {
    it("handles valid response with description", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "A person walking in a park" }],
                },
              },
            ],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const result = await describeVideoViaGemini({
        filePath: mockFilePath,
        apiKey: mockApiKey,
      });

      expect(result).toEqual({
        text: "A person walking in a park",
        provider: "gemini",
        model: "gemini-3-flash-preview",
      });
    });

    it("trims whitespace from description", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "  A video description  \n" }],
                },
              },
            ],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const result = await describeVideoViaGemini({
        filePath: mockFilePath,
        apiKey: mockApiKey,
      });

      expect(result.text).toBe("A video description");
    });

    it("uses custom model when provided", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Test" }],
                },
              },
            ],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const result = await describeVideoViaGemini({
        filePath: mockFilePath,
        apiKey: mockApiKey,
        model: "custom-model",
      });

      expect(result.model).toBe("custom-model");
    });
  });

  describe("HTTP errors", () => {
    it("throws error on HTTP error response", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ error: "Internal server error" }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API error (HTTP 500)");
    });

    it("includes error preview in HTTP error message", async () => {
      const errorMessage = "Rate limit exceeded";
      const mockResponse = {
        ok: false,
        status: 429,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ error: errorMessage }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe("JSON validation", () => {
    it("throws error on malformed JSON", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => "{ invalid json",
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API invalid JSON");
    });

    it("throws error when JSON is not an object", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => '"just a string"',
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API response is not an object");
    });

    it("throws error when JSON is null", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => "null",
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API response is not an object");
    });
  });

  describe("API error responses", () => {
    it("throws error when response contains error field", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            error: { message: "Rate limit exceeded", code: 429 },
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API error");
    });

    it("includes error details in error message", async () => {
      const errorObj = { message: "Invalid video format" };
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            error: errorObj,
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow(JSON.stringify(errorObj));
    });
  });

  describe("candidates array validation", () => {
    it("throws error when candidates is missing", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ foo: "bar" }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API missing candidates array");
    });

    it("throws error when candidates is not an array", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ candidates: "not an array" }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API missing candidates array");
    });

    it("throws error when candidates is null", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ candidates: null }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API missing candidates array");
    });

    it("throws error when candidates array is empty", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ candidates: [] }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API returned empty candidates array");
    });
  });

  describe("candidate structure validation", () => {
    it("throws error when candidate is not an object", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ candidates: ["not an object"] }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API candidate is not an object");
    });

    it("throws error when candidate is null", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ candidates: [null] }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API candidate is not an object");
    });

    it("throws error when content is missing", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ candidates: [{ foo: "bar" }] }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API candidate missing content");
    });

    it("throws error when content is not an object", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({ candidates: [{ content: "not an object" }] }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API candidate missing content");
    });

    it("throws error when content is null", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({ candidates: [{ content: null }] }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API candidate missing content");
    });
  });

  describe("parts array validation", () => {
    it("throws error when parts is missing", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { foo: "bar" } }],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API content missing parts array");
    });

    it("throws error when parts is not an array", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: "not an array" } }],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API content missing parts array");
    });

    it("throws error when parts is null", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: null } }],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API content missing parts array");
    });

    it("throws error when parts array is empty", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: [] } }],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API returned empty parts array");
    });
  });

  describe("part structure validation", () => {
    it("throws error when part is not an object", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: ["not an object"] } }],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API part is not an object");
    });

    it("throws error when part is null", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: [null] } }],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API part is not an object");
    });

    it("throws error when text field is missing", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: [{ foo: "bar" }] } }],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API part missing valid text");
    });

    it("throws error when text field is not a string", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 12345 }] } }],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API part missing valid text");
    });

    it("throws error when text field is null", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: null }] } }],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API part missing valid text");
    });

    it("throws error when text field is undefined", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: undefined }] } }],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API part missing valid text");
    });
  });

  describe("empty text validation", () => {
    it("throws error when text is empty string", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "" }] } }],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API returned empty description");
    });

    it("throws error when text is only whitespace", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "   \n\t  " }] } }],
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        describeVideoViaGemini({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Gemini API returned empty description");
    });
  });

  describe("request parameters", () => {
    it("sends correct request body with base64 video data", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Test" }] } }],
          }),
      };

      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal("fetch", mockFetch);

      await describeVideoViaGemini({
        filePath: mockFilePath,
        apiKey: mockApiKey,
        prompt: "Describe this video",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("generativelanguage.googleapis.com"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );

      const call = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(call[1].body);
      expect(requestBody.contents[0].parts[0]).toHaveProperty("inline_data");
      expect(requestBody.contents[0].parts[1].text).toBe("Describe this video");
    });
  });
});
