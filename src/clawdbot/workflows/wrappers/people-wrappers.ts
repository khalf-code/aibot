/**
 * People (HR) workflow wrapper types — Business Skill Packs
 *
 * Covers:
 *   - BIZ-087 (#179) Interview scheduling assistant workflow wrapper
 *   - BIZ-090 (#182) New hire paperwork checklist workflow wrapper
 *
 * Each wrapper type defines the orchestration shape for its People
 * workflow, including inputs, outputs, step definitions, and execution state.
 */

import type {
  InterviewFormat,
  InterviewSlot,
  InterviewCandidate,
  PaperworkCategory,
  PaperworkItem,
} from "../gates/people-gates.js";
import type { RetryPolicy, ErrorHandler } from "../retry-policy.js";
import type { WorkflowTrigger } from "../trigger.js";

// ---------------------------------------------------------------------------
// Shared wrapper types
// ---------------------------------------------------------------------------

/** Execution status for a workflow run. */
export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

/** Common fields shared by all People workflow wrappers. */
export type PeopleWrapperBase = {
  /** Workflow definition ID (template). */
  workflowId: string;
  /** Unique execution / run ID. */
  runId: string;
  /** Current execution status. */
  status: WorkflowRunStatus;
  /** Trigger that initiated this run. */
  trigger: WorkflowTrigger;
  /** Retry policy applied to recoverable steps. */
  retryPolicy: RetryPolicy;
  /** Error handler for unrecoverable failures. */
  errorHandler: ErrorHandler;
  /** ISO-8601 timestamp when the run started. */
  startedAt: string;
  /** ISO-8601 timestamp when the run completed (if finished). */
  completedAt?: string;
  /** Wall-clock duration in milliseconds (set on completion). */
  durationMs?: number;
};

// ---------------------------------------------------------------------------
// BIZ-087 (#179) — Interview scheduling assistant workflow wrapper
// ---------------------------------------------------------------------------

/** Step identifiers for the interview scheduling workflow. */
export type InterviewSchedulingStep =
  | "receive_scheduling_request"
  | "fetch_interviewer_availability"
  | "fetch_candidate_preferences"
  | "check_room_availability"
  | "generate_schedule"
  | "detect_conflicts"
  | "approval_gate"
  | "send_calendar_invites"
  | "notify_recruiter"
  | "notify_candidate";

/** Input parameters for the interview scheduling workflow. */
export type InterviewSchedulingInput = {
  /** Candidate details. */
  candidate: InterviewCandidate;
  /** Required interview stages (e.g. ["phone_screen", "technical", "cultural_fit"]). */
  requiredStages: string[];
  /** Preferred interview formats per stage. */
  preferredFormats: Record<string, InterviewFormat>;
  /** Scheduling window start (ISO-8601). */
  windowStart: string;
  /** Scheduling window end (ISO-8601). */
  windowEnd: string;
  /** Candidate's preferred timezone (IANA). */
  candidateTimezone: string;
  /** Interviewer IDs or names to include. */
  interviewers: string[];
  /** Notification channel for the recruiter. */
  notificationChannel: string;
};

/** Output produced by the interview scheduling workflow. */
export type InterviewSchedulingOutput = {
  /** Proposed interview slots. */
  slots: InterviewSlot[];
  /** Scheduling conflicts detected. */
  conflicts: string[];
  /** Whether all interviewers confirmed availability. */
  allInterviewersConfirmed: boolean;
  /** Calendar invite URLs (one per slot). */
  calendarInviteUrls: string[];
  /** Whether the candidate was notified. */
  candidateNotified: boolean;
  /** Summary message for recruiter. */
  summaryMessage: string;
};

/**
 * Workflow wrapper for the interview scheduling assistant.
 * Orchestrates receiving a scheduling request, fetching availability
 * from interviewers and the candidate, checking room/resource
 * availability, generating an optimal schedule, detecting conflicts,
 * gating on recruiter approval, then sending calendar invites and
 * notifications.
 */
export type InterviewSchedulingWrapper = PeopleWrapperBase & {
  kind: "interview_scheduling";
  input: InterviewSchedulingInput;
  output?: InterviewSchedulingOutput;
  currentStep: InterviewSchedulingStep;
};

// ---------------------------------------------------------------------------
// BIZ-090 (#182) — New hire paperwork checklist workflow wrapper
// ---------------------------------------------------------------------------

/** Step identifiers for the new hire paperwork workflow. */
export type NewHirePaperworkStep =
  | "receive_new_hire_info"
  | "determine_jurisdiction"
  | "generate_checklist"
  | "attach_document_links"
  | "approval_gate"
  | "send_checklist_to_hire"
  | "track_completion"
  | "send_reminders"
  | "notify_hr_on_completion";

/** Input parameters for the new hire paperwork workflow. */
export type NewHirePaperworkInput = {
  /** New hire full name. */
  employeeName: string;
  /** New hire email. */
  email: string;
  /** Job title. */
  jobTitle: string;
  /** Employment type. */
  employmentType: "full_time" | "part_time" | "contractor" | "intern";
  /** Work location (city, state/province, country). */
  workLocation: string;
  /** Start date (ISO-8601). */
  startDate: string;
  /** Paperwork categories to include (empty = all applicable). */
  categories: PaperworkCategory[];
  /** Reminder frequency in days (for incomplete items). */
  reminderFrequencyDays: number;
  /** HR contact name for questions. */
  hrContactName: string;
};

/** Output produced by the new hire paperwork workflow. */
export type NewHirePaperworkOutput = {
  /** Generated paperwork checklist. */
  items: PaperworkItem[];
  /** Total items in the checklist. */
  totalItems: number;
  /** Items completed by the new hire. */
  completedItems: number;
  /** Items still pending. */
  pendingItems: number;
  /** Checklist URL (portal link for the new hire). */
  checklistUrl: string;
  /** Whether the checklist email was sent to the new hire. */
  checklistEmailSent: boolean;
  /** Summary message for HR notification. */
  summaryMessage: string;
};

/**
 * Workflow wrapper for the new hire paperwork checklist.
 * Orchestrates receiving new hire information, determining jurisdiction-
 * specific requirements, generating a personalised checklist, attaching
 * document links, gating on HR approval, sending the checklist to
 * the new hire, tracking completion, sending reminders, and notifying
 * HR when all items are complete.
 */
export type NewHirePaperworkWrapper = PeopleWrapperBase & {
  kind: "new_hire_paperwork";
  input: NewHirePaperworkInput;
  output?: NewHirePaperworkOutput;
  currentStep: NewHirePaperworkStep;
};

// ---------------------------------------------------------------------------
// Discriminated union of all People wrappers
// ---------------------------------------------------------------------------

/** Union of all People workflow wrapper configurations. */
export type PeopleWorkflowWrapper = InterviewSchedulingWrapper | NewHirePaperworkWrapper;
