/**
 * UI-004 (#65) -- Run detail view with inspector drawer
 *
 * Type definitions for the detailed view of a single run, including
 * the step timeline, inspector drawer for drilling into individual
 * steps, and real-time status updates.
 */

import type { Run, RunStep } from "../types/run.ts";

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

/** The kind of event shown in the run timeline. */
export type TimelineEntryType =
  | "state_change"
  | "step_started"
  | "step_completed"
  | "step_failed"
  | "approval_requested"
  | "approval_decided"
  | "artifact_created"
  | "error";

/** A single entry in the run's event timeline. */
export type TimelineEntry = {
  /** Unique entry identifier. */
  id: string;
  /** Kind of timeline event. */
  type: TimelineEntryType;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Short human-readable summary of the event. */
  summary: string;
  /** Optional detailed payload (step output, error stack, etc.). */
  detail?: unknown;
  /** ID of the related run step (if applicable). */
  stepId?: string;
  /** Actor who caused this event (user, system, policy). */
  actor?: string;
};

// ---------------------------------------------------------------------------
// Step inspection
// ---------------------------------------------------------------------------

/** Detailed inspection data for a single run step (shown in the drawer). */
export type StepInspection = {
  /** The full run step record. */
  step: RunStep;
  /** Formatted input payload for display. */
  formattedInput: string;
  /** Formatted output payload for display (undefined until step completes). */
  formattedOutput?: string;
  /** Duration string (e.g. `"1.2s"`, `"45ms"`). */
  durationLabel?: string;
  /** Artifact references produced by this step. */
  artifactIds: string[];
  /** Timeline entries scoped to this step. */
  timelineEntries: TimelineEntry[];
  /** Redaction rules that were applied to this step's output. */
  redactedFields: string[];
};

// ---------------------------------------------------------------------------
// Inspector drawer
// ---------------------------------------------------------------------------

/** State of the side-panel inspector drawer. */
export type InspectorDrawer = {
  /** Whether the drawer is currently open. */
  open: boolean;
  /** Width of the drawer in pixels. */
  widthPx: number;
  /** ID of the step currently being inspected (undefined when closed). */
  selectedStepId?: string;
  /** Inspection data for the selected step (undefined while loading). */
  inspection?: StepInspection;
  /** Whether the inspection data is currently loading. */
  loading: boolean;
};

// ---------------------------------------------------------------------------
// Run detail view
// ---------------------------------------------------------------------------

/** Complete state for the run detail page. */
export type RunDetailView = {
  /** The full run record being viewed. */
  run: Run;
  /** Chronological timeline of events for this run. */
  timeline: TimelineEntry[];
  /** Inspector drawer state. */
  drawer: InspectorDrawer;
  /**
   * Whether the view is streaming live updates for an in-progress run.
   * When `true`, the timeline and run state update in real time.
   */
  liveUpdates: boolean;
  /** Tab currently active in the detail view. */
  activeTab: RunDetailTab;
};

/** Tabs available in the run detail view. */
export type RunDetailTab = "timeline" | "steps" | "artifacts" | "cost" | "logs";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default inspector drawer state (closed). */
export const DEFAULT_INSPECTOR_DRAWER: InspectorDrawer = {
  open: false,
  widthPx: 480,
  loading: false,
};
