import fs from "node:fs/promises";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { transcribeViaGroq } from "./groq.js";

// Mock fs and fetch
vi.mock("node:fs/promises");

describe("transcribeViaGroq", () => {
  const mockApiKey = "test-api-key";
  const mockFilePath = "/tmp/test-audio.mp3";

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock file reading
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("fake audio data"));
    // Clear any existing fetch mocks
    vi.unstubAllGlobals();
  });

  describe("successful transcription", () => {
    it("handles valid JSON response with text", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ text: "Hello world" }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const result = await transcribeViaGroq({
        filePath: mockFilePath,
        apiKey: mockApiKey,
      });

      expect(result).toEqual({
        text: "Hello world",
        provider: "groq",
        model: "whisper-large-v3-turbo",
      });
    });

    it("trims whitespace from transcription", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ text: "  Hello world  \n" }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const result = await transcribeViaGroq({
        filePath: mockFilePath,
        apiKey: mockApiKey,
      });

      expect(result.text).toBe("Hello world");
    });

    it("handles plain text response", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        text: async () => "Plain text transcript",
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const result = await transcribeViaGroq({
        filePath: mockFilePath,
        apiKey: mockApiKey,
      });

      expect(result.text).toBe("Plain text transcript");
    });

    it("uses custom model when provided", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ text: "Test" }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      const result = await transcribeViaGroq({
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
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Groq STT error (HTTP 500)");
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
        transcribeViaGroq({
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
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Groq STT invalid JSON");
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
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Groq STT response is not an object");
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
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Groq STT response is not an object");
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
            error: { message: "Rate limit exceeded", type: "rate_limit" },
            text: null,
          }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Groq STT API error");
    });

    it("includes error details in error message", async () => {
      const errorObj = { message: "Invalid audio format" };
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
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow(JSON.stringify(errorObj));
    });
  });

  describe("text field validation", () => {
    it("throws error when text field is missing", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ foo: "bar" }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Groq STT missing valid text");
    });

    it("throws error when text field is not a string", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ text: 12345 }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Groq STT missing valid text");
    });

    it("throws error when text field is null", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ text: null }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Groq STT missing valid text");
    });

    it("throws error when text field is undefined", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ text: undefined }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Groq STT missing valid text");
    });
  });

  describe("empty text validation", () => {
    it("throws error when JSON text is empty string", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ text: "" }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Groq STT returned empty transcript");
    });

    it("throws error when JSON text is only whitespace", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ text: "   \n\t  " }),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Groq STT returned empty transcript");
    });

    it("throws error when plain text response is empty", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        text: async () => "",
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Groq STT returned empty transcript");
    });

    it("throws error when plain text response is only whitespace", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        text: async () => "   \n\t  ",
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        transcribeViaGroq({
          filePath: mockFilePath,
          apiKey: mockApiKey,
        }),
      ).rejects.toThrow("Groq STT returned empty transcript");
    });
  });

  describe("request parameters", () => {
    it("sends correct headers and form data", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ text: "Test" }),
      };

      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal("fetch", mockFetch);

      await transcribeViaGroq({
        filePath: mockFilePath,
        apiKey: mockApiKey,
        language: "en",
        prompt: "transcribe this audio",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
          },
        }),
      );

      const call = mockFetch.mock.calls[0];
      const formData = call[1].body as FormData;
      expect(formData.get("model")).toBe("whisper-large-v3-turbo");
      expect(formData.get("language")).toBe("en");
      expect(formData.get("prompt")).toBe("transcribe this audio");
    });
  });
});
