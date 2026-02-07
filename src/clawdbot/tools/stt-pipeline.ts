/**
 * TOOLS-011 (#47) -- Speech-to-text pipeline
 *
 * Provider interface and types for transcribing audio into text.
 * Implementations may wrap OpenAI Whisper, Google Cloud Speech-to-Text,
 * AWS Transcribe, Azure Speech, or local models.
 *
 * @see ./voice-runner.ts for voice call integration
 * @see ./tts-pipeline.ts for the inverse (text-to-speech)
 * @module
 */

// ---------------------------------------------------------------------------
// Transcript segment
// ---------------------------------------------------------------------------

/** A time-aligned segment within a transcript. */
export type TranscriptSegment = {
  /** Transcribed text for this segment. */
  text: string;

  /** Start time in seconds from the beginning of the audio. */
  start_seconds: number;

  /** End time in seconds from the beginning of the audio. */
  end_seconds: number;

  /** Confidence score for this segment (0-1). */
  confidence: number;

  /**
   * Speaker label for diarized transcripts.
   * Only present when the provider supports speaker diarization and
   * `SttOptions.diarize` is `true`.
   */
  speaker?: string;
};

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

/** The full result of a speech-to-text transcription. */
export type Transcript = {
  /** The complete transcribed text (concatenation of all segments). */
  text: string;

  /** Time-aligned segments (may be empty if the provider does not segment). */
  segments: TranscriptSegment[];

  /** Detected language code (BCP-47, e.g. `"en-US"`, `"ja"`). */
  language: string;

  /** Overall confidence score (0-1). */
  confidence: number;

  /** Duration of the transcribed audio in seconds. */
  duration_seconds?: number;

  /** Number of distinct speakers detected (when diarization is enabled). */
  speaker_count?: number;
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options controlling the transcription process. */
export type SttOptions = {
  /**
   * BCP-47 language hint for the transcription engine.
   * When omitted, the provider auto-detects the language.
   */
  language?: string;

  /**
   * Whether to enable speaker diarization (who spoke when).
   * Defaults to `false`.
   */
  diarize?: boolean;

  /**
   * Audio format hint. Most providers accept `"wav"`, `"mp3"`, `"ogg"`,
   * `"flac"`, `"webm"`. When omitted, the provider infers from headers.
   */
  format?: string;

  /**
   * Sample rate in Hz (e.g. 16000, 44100). Required by some providers
   * for raw PCM input.
   */
  sample_rate_hz?: number;

  /**
   * Custom vocabulary / keyword boosting.
   * Terms listed here receive higher recognition priority.
   */
  vocabulary_boost?: string[];

  /**
   * Maximum audio duration to transcribe in seconds.
   * Audio beyond this point is silently truncated.
   */
  max_duration_seconds?: number;
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Speech-to-text provider interface.
 *
 * Implementations wrap a specific STT backend and expose a uniform API
 * for the Clawdbot tool runner.
 */
export type SttProvider = {
  /** Human-readable name (e.g. `"Whisper"`, `"Google STT"`). */
  readonly name: string;

  /**
   * Transcribe audio data into text.
   *
   * @param audio Raw audio bytes (the format is communicated via `options.format`).
   * @param options Transcription options.
   * @returns The transcription result.
   */
  transcribe(audio: Uint8Array, options?: SttOptions): Promise<Transcript>;
};
