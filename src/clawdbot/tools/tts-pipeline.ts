/**
 * TOOLS-012 (#48) -- Text-to-speech pipeline
 *
 * Provider interface and types for synthesizing speech from text.
 * Implementations may wrap OpenAI TTS, Google Cloud Text-to-Speech,
 * AWS Polly, Azure Speech, ElevenLabs, or local models.
 *
 * @see ./voice-runner.ts for voice call integration
 * @see ./stt-pipeline.ts for the inverse (speech-to-text)
 * @module
 */

// ---------------------------------------------------------------------------
// Audio format
// ---------------------------------------------------------------------------

/**
 * Supported output audio formats.
 *
 * Not all providers support every format; the provider implementation
 * should throw a descriptive error when an unsupported format is requested.
 */
export type TtsAudioFormat = "mp3" | "wav" | "ogg" | "flac" | "pcm" | "aac" | "opus";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options controlling the speech synthesis process. */
export type TtsOptions = {
  /**
   * Voice identifier.
   *
   * Interpretation is provider-specific:
   * - OpenAI: `"alloy"`, `"echo"`, `"fable"`, `"onyx"`, `"nova"`, `"shimmer"`
   * - Google: `"en-US-Standard-A"`, `"en-GB-Wavenet-B"`, etc.
   * - ElevenLabs: voice ID string
   *
   * When omitted, the provider uses its default voice.
   */
  voice?: string;

  /**
   * Speech rate multiplier.
   *
   * `1.0` is normal speed. Values below 1.0 slow down; above 1.0 speed up.
   * Typical range: 0.25 - 4.0. Defaults to `1.0`.
   */
  speed?: number;

  /**
   * Output audio format.
   * Defaults to `"mp3"` when omitted.
   */
  format?: TtsAudioFormat;

  /**
   * BCP-47 language code hint (e.g. `"en-US"`, `"de-DE"`).
   * Some providers require this when the voice is multilingual.
   */
  language?: string;

  /**
   * Audio sample rate in Hz for raw / PCM output (e.g. 24000, 44100).
   * Ignored for compressed formats that embed sample rate in headers.
   */
  sample_rate_hz?: number;

  /**
   * Pitch adjustment.
   *
   * `0` is default pitch. Positive values raise pitch; negative lower it.
   * Typical range: -20 to +20 semitones (provider-dependent).
   */
  pitch?: number;

  /**
   * SSML (Speech Synthesis Markup Language) mode.
   *
   * When `true`, the input text is interpreted as SSML instead of plain
   * text. The caller is responsible for providing well-formed SSML.
   */
  ssml?: boolean;
};

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/** The result of a text-to-speech synthesis. */
export type TtsResult = {
  /** Synthesized audio data. */
  audio: Uint8Array;

  /** The audio format of the output (echoed from options or provider default). */
  format: TtsAudioFormat;

  /** Duration of the synthesized audio in seconds. */
  duration_seconds: number;

  /** Number of characters / SSML units consumed. */
  characters_used: number;

  /** The voice that was used (may differ from requested if the requested voice was unavailable). */
  voice_used: string;
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Text-to-speech provider interface.
 *
 * Implementations wrap a specific TTS backend and expose a uniform API
 * for the Clawdbot tool runner.
 */
export type TtsProvider = {
  /** Human-readable name (e.g. `"OpenAI TTS"`, `"ElevenLabs"`). */
  readonly name: string;

  /**
   * Synthesize speech from text.
   *
   * @param text Plain text or SSML to synthesize (depending on `options.ssml`).
   * @param options Synthesis options.
   * @returns The synthesized audio and metadata.
   */
  synthesize(text: string, options?: TtsOptions): Promise<TtsResult>;

  /**
   * List available voices for this provider.
   *
   * @returns An array of `{ id, name, language }` descriptors.
   */
  listVoices?(): Promise<Array<{ id: string; name: string; language: string }>>;
};
