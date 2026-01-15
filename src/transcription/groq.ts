import fs from "node:fs/promises";
import path from "node:path";

export type GroqTranscribeOptions = {
  filePath: string;
  apiKey: string;
  model?: string;
  language?: string;
  prompt?: string;
  timeoutMs?: number;
};

export type TranscriptionResult = {
  text: string;
  provider: "groq";
  model: string;
};

const GROQ_TRANSCRIPTION_ENDPOINT =
  "https://api.groq.com/openai/v1/audio/transcriptions";

const DEFAULT_MODEL = "whisper-large-v3-turbo";
const DEFAULT_TIMEOUT_MS = 60_000;

function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".flac":
      return "audio/flac";
    case ".mp3":
      return "audio/mpeg";
    case ".mp4":
    case ".m4a":
      return "audio/mp4";
    case ".mpeg":
    case ".mpga":
      return "audio/mpeg";
    case ".ogg":
      return "audio/ogg";
    case ".wav":
      return "audio/wav";
    case ".webm":
      return "audio/webm";
    default:
      return "application/octet-stream";
  }
}

export async function transcribeViaGroq(
  options: GroqTranscribeOptions,
): Promise<TranscriptionResult> {
  const {
    filePath,
    apiKey,
    model = DEFAULT_MODEL,
    language,
    prompt,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const buffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);
  const mime = guessMime(filePath);

  const form = new FormData();
  form.set("model", model);
  form.set("file", new Blob([buffer], { type: mime }), fileName);
  if (language) form.set("language", language);
  if (prompt) form.set("prompt", prompt);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(GROQ_TRANSCRIPTION_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    if (!res.ok) {
      const errorPreview = text.slice(0, 500);
      throw new Error(`Groq STT error (HTTP ${res.status}): ${errorPreview}`);
    }

    let transcript: string;
    if (contentType.includes("application/json")) {
      // Parse JSON with error handling
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Groq STT invalid JSON: ${text.slice(0, 200)}`);
      }

      // Validate it's an object
      if (typeof json !== "object" || json === null) {
        throw new Error("Groq STT response is not an object");
      }

      const typedJson = json as { text?: unknown; error?: unknown };

      // Check for API error
      if (typedJson.error) {
        throw new Error(`Groq STT API error: ${JSON.stringify(typedJson.error)}`);
      }

      // Validate text field exists and is a string
      if (typeof typedJson.text !== "string") {
        throw new Error(
          `Groq STT missing valid text: ${JSON.stringify(json).slice(0, 200)}`,
        );
      }

      // Check for empty transcript
      if (typedJson.text.trim().length === 0) {
        throw new Error("Groq STT returned empty transcript");
      }

      transcript = typedJson.text;
    } else {
      // Plain text response
      transcript = text;
      if (transcript.trim().length === 0) {
        throw new Error("Groq STT returned empty transcript");
      }
    }

    return {
      text: transcript.trim(),
      provider: "groq",
      model,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
