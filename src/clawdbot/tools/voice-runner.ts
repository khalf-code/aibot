/**
 * TOOLS-010 (#46) -- Voice calling
 *
 * Provider interface and types for outbound and inbound voice calls.
 * Implementations may wrap Twilio, Vonage, WebRTC, or other telephony
 * backends.
 *
 * @see ./stt-pipeline.ts for speech-to-text transcription
 * @see ./tts-pipeline.ts for text-to-speech synthesis
 * @module
 */

// ---------------------------------------------------------------------------
// Call status
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a voice call.
 *
 * - `queued`      -- call request accepted, not yet dialing
 * - `ringing`     -- outbound ring in progress
 * - `in_progress` -- call connected
 * - `completed`   -- call ended normally
 * - `failed`      -- call could not be placed or was dropped
 * - `busy`        -- callee line was busy
 * - `no_answer`   -- callee did not answer within the ring timeout
 * - `canceled`    -- caller canceled before connection
 */
export type VoiceCallStatus =
  | "queued"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "busy"
  | "no_answer"
  | "canceled";

// ---------------------------------------------------------------------------
// VoiceCall
// ---------------------------------------------------------------------------

/** A voice call record. */
export type VoiceCall = {
  /** Provider-specific call ID. */
  id: string;

  /** Caller phone number or SIP URI. */
  from: string;

  /** Callee phone number or SIP URI. */
  to: string;

  /** Current call status. */
  status: VoiceCallStatus;

  /** Duration of the connected portion of the call in seconds. */
  duration_seconds: number;

  /**
   * Vault reference to the call recording (if recording was enabled).
   * Format: `artifact://<id>` -- resolved via the artifact store.
   * **Never** contains raw audio data.
   */
  recording_ref?: string;

  /** ISO-8601 timestamp of when the call was initiated. */
  initiated_at: string;

  /** ISO-8601 timestamp of when the call connected (undefined if never connected). */
  connected_at?: string;

  /** ISO-8601 timestamp of when the call ended (undefined if still in progress). */
  ended_at?: string;

  /** Direction of the call. */
  direction: "outbound" | "inbound";

  /** Provider-specific metadata (e.g. SIP headers, Twilio SID). */
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Initiate options
// ---------------------------------------------------------------------------

/** Options for initiating an outbound voice call. */
export type VoiceCallInitiateOptions = {
  /** Caller ID / from number. */
  from: string;

  /** Callee number or SIP URI. */
  to: string;

  /** Whether to record the call. Defaults to `false`. */
  record?: boolean;

  /**
   * Maximum call duration in seconds. The call is automatically ended
   * when this limit is reached. Defaults to 3600 (1 hour).
   */
  max_duration_seconds?: number;

  /**
   * Ring timeout in seconds. If the callee does not answer within this
   * period, the call transitions to `no_answer`. Defaults to 30.
   */
  ring_timeout_seconds?: number;

  /**
   * Optional TTS greeting to play when the callee picks up.
   * Passed to the TTS pipeline for synthesis before playback.
   */
  greeting_text?: string;

  /** Provider-specific metadata to attach to the call. */
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Voice calling provider interface.
 *
 * Implementations wrap a specific telephony backend (Twilio, Vonage,
 * WebRTC bridge, etc.) and expose a uniform API for the Clawdbot
 * tool runner.
 */
export type VoiceProvider = {
  /** Human-readable name (e.g. `"Twilio"`, `"Vonage"`). */
  readonly name: string;

  /**
   * Initiate an outbound voice call.
   *
   * @returns The call record with initial status (typically `queued` or `ringing`).
   */
  initiateCall(options: VoiceCallInitiateOptions): Promise<VoiceCall>;

  /**
   * End an active call.
   *
   * @param callId Provider-specific call ID.
   * @returns The updated call record with final status.
   * @throws {Error} If the call does not exist or is already ended.
   */
  endCall(callId: string): Promise<VoiceCall>;

  /**
   * Get the current status of a call.
   *
   * @param callId Provider-specific call ID.
   * @returns The call record with the latest status.
   * @throws {Error} If the call does not exist.
   */
  getCallStatus(callId: string): Promise<VoiceCall>;
};
