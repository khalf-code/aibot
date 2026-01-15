import fs from "node:fs/promises";
import path from "node:path";

export type GeminiDescribeOptions = {
  filePath: string;
  apiKey: string;
  model?: string;
  prompt?: string;
  timeoutMs?: number;
};

export type VideoDescriptionResult = {
  text: string;
  provider: "gemini";
  model: string;
};

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3-flash-preview";
const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes for video processing

const DEFAULT_PROMPT = `You are analyzing a video sent in a chat conversation. Provide a detailed but concise description (2-4 sentences) that captures:
- The main action or subject of the video
- Key visual elements (people, objects, setting)
- Any notable movement, changes, or events
- Mood or context if apparent

Be specific and descriptive so someone who hasn't seen the video understands what it shows.`;

function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mov":
      return "video/quicktime";
    case ".avi":
      return "video/x-msvideo";
    case ".mkv":
      return "video/x-matroska";
    case ".3gp":
      return "video/3gpp";
    default:
      return "video/mp4";
  }
}

export async function describeVideoViaGemini(
  options: GeminiDescribeOptions,
): Promise<VideoDescriptionResult> {
  const {
    filePath,
    apiKey,
    model = DEFAULT_MODEL,
    prompt = DEFAULT_PROMPT,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const buffer = await fs.readFile(filePath);
  const base64Data = buffer.toString("base64");
  const mimeType = guessMime(filePath);

  const endpoint = `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: base64Data } },
          { text: prompt },
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const responseText = await res.text();

    if (!res.ok) {
      const errorPreview = responseText.slice(0, 500);
      throw new Error(`Gemini API error (HTTP ${res.status}): ${errorPreview}`);
    }

    // Parse JSON with error handling
    let json: unknown;
    try {
      json = JSON.parse(responseText);
    } catch {
      throw new Error(`Gemini API invalid JSON: ${responseText.slice(0, 200)}`);
    }

    // Validate it's an object
    if (typeof json !== "object" || json === null) {
      throw new Error("Gemini API response is not an object");
    }

    const typedJson = json as {
      candidates?: unknown;
      error?: unknown;
    };

    // Check for API error
    if (typedJson.error) {
      throw new Error(`Gemini API error: ${JSON.stringify(typedJson.error)}`);
    }

    // Validate candidates array exists
    if (!Array.isArray(typedJson.candidates)) {
      throw new Error(
        `Gemini API missing candidates array: ${JSON.stringify(json).slice(0, 200)}`,
      );
    }

    if (typedJson.candidates.length === 0) {
      throw new Error("Gemini API returned empty candidates array");
    }

    // Validate first candidate structure
    const candidate = typedJson.candidates[0];
    if (typeof candidate !== "object" || candidate === null) {
      throw new Error("Gemini API candidate is not an object");
    }

    const typedCandidate = candidate as {
      content?: unknown;
    };

    if (
      typeof typedCandidate.content !== "object" ||
      typedCandidate.content === null
    ) {
      throw new Error(
        `Gemini API candidate missing content: ${JSON.stringify(candidate).slice(0, 200)}`,
      );
    }

    const typedContent = typedCandidate.content as {
      parts?: unknown;
    };

    if (!Array.isArray(typedContent.parts)) {
      throw new Error("Gemini API content missing parts array");
    }

    if (typedContent.parts.length === 0) {
      throw new Error("Gemini API returned empty parts array");
    }

    // Validate first part has text
    const part = typedContent.parts[0];
    if (typeof part !== "object" || part === null) {
      throw new Error("Gemini API part is not an object");
    }

    const typedPart = part as { text?: unknown };

    if (typeof typedPart.text !== "string") {
      throw new Error(
        `Gemini API part missing valid text: ${JSON.stringify(part).slice(0, 200)}`,
      );
    }

    // Check for empty description
    if (typedPart.text.trim().length === 0) {
      throw new Error("Gemini API returned empty description");
    }

    return {
      text: typedPart.text.trim(),
      provider: "gemini",
      model,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
