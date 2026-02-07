/**
 * OBS-004 (#88) -- Screenshot/video capture toggles
 *
 * Types and helpers for configuring when the Clawdbot runtime should
 * capture screenshots or video recordings during skill execution.
 * Capture can be toggled per-environment, per-skill, or per-step to
 * balance debuggability against storage and performance costs.
 */

// ---------------------------------------------------------------------------
// Capture mode
// ---------------------------------------------------------------------------

/** Controls when media capture is active. */
export type CaptureMode =
  /** Never capture. */
  | "off"
  /** Capture only when a step fails. */
  | "on_failure"
  /** Capture at every step boundary. */
  | "on_step"
  /** Capture continuously (video recording mode). */
  | "always";

// ---------------------------------------------------------------------------
// Capture config
// ---------------------------------------------------------------------------

/** Per-run or per-skill capture configuration. */
export type CaptureConfig = {
  /** Whether screenshot capture is enabled. */
  screenshotEnabled: boolean;
  /** Screenshot capture mode. */
  screenshotMode: CaptureMode;
  /** Whether video recording is enabled. */
  videoEnabled: boolean;
  /** Video capture mode. */
  videoMode: CaptureMode;
  /** Maximum number of screenshots to retain per run. */
  maxScreenshotsPerRun: number;
  /** Maximum video duration in seconds (0 = unlimited). */
  maxVideoDurationSec: number;
  /** Output directory for captured media (relative to artifact store root). */
  outputDir: string;
  /**
   * Skill names for which capture is always enabled regardless of mode.
   * Useful for high-risk skills that warrant full audit trails.
   */
  alwaysCaptureSkills: string[];
};

// ---------------------------------------------------------------------------
// Capture result
// ---------------------------------------------------------------------------

/** Metadata for a single captured media artifact. */
export type CaptureResult = {
  /** Type of captured media. */
  type: "screenshot" | "video";
  /** Absolute path to the captured file. */
  filePath: string;
  /** MIME type of the file (e.g. "image/png", "video/webm"). */
  mimeType: string;
  /** File size in bytes. */
  sizeBytes: number;
  /** ISO-8601 timestamp of when the capture was taken. */
  capturedAt: string;
  /** Run ID this capture belongs to. */
  runId: string;
  /** Step ID that triggered the capture (if applicable). */
  stepId?: string;
  /** Whether this capture was triggered by a failure. */
  triggeredByFailure: boolean;
};

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

/** Sensible defaults: screenshots on failure only, video off. */
export const DEFAULT_CAPTURE_CONFIG: Readonly<CaptureConfig> = {
  screenshotEnabled: true,
  screenshotMode: "on_failure",
  videoEnabled: false,
  videoMode: "off",
  maxScreenshotsPerRun: 20,
  maxVideoDurationSec: 300,
  outputDir: "captures",
  alwaysCaptureSkills: [],
};

// ---------------------------------------------------------------------------
// Decision function
// ---------------------------------------------------------------------------

/**
 * Determine whether a capture should be taken given the current
 * configuration, step state, and context.
 *
 * @param config - Active capture configuration.
 * @param mediaType - The type of capture being considered.
 * @param context - Contextual information about the current execution point.
 * @returns `true` if a capture should be taken.
 */
export function shouldCapture(
  config: CaptureConfig,
  mediaType: "screenshot" | "video",
  context: {
    /** Whether the current step has failed. */
    stepFailed: boolean;
    /** Whether we are at a step boundary (start or end). */
    atStepBoundary: boolean;
    /** Name of the skill being executed. */
    skillName: string;
  },
): boolean {
  const enabled = mediaType === "screenshot" ? config.screenshotEnabled : config.videoEnabled;
  if (!enabled) {
    return false;
  }

  // Always-capture override for designated high-risk skills.
  if (config.alwaysCaptureSkills.includes(context.skillName)) {
    return true;
  }

  const mode = mediaType === "screenshot" ? config.screenshotMode : config.videoMode;

  switch (mode) {
    case "off":
      return false;
    case "on_failure":
      return context.stepFailed;
    case "on_step":
      return context.atStepBoundary;
    case "always":
      return true;
    default:
      return false;
  }
}
