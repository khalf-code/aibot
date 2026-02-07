/**
 * People (HR) approval gate types — Business Skill Packs
 *
 * Covers:
 *   - BIZ-086 (#178) Interview scheduling assistant approval gate
 *   - BIZ-089 (#181) New hire paperwork checklist approval gate
 *
 * Each gate configuration defines the approval parameters for its
 * corresponding People workflow. Gates are evaluated by the Clawdbot
 * Approval Gate node (WF-005) at runtime.
 */

import type { ApprovalStatus } from "../approval-node.js";

// ---------------------------------------------------------------------------
// Shared People gate types
// ---------------------------------------------------------------------------

/** Common fields shared by all People approval gate configurations. */
export type PeopleGateBase = {
  /** Unique gate identifier (scoped to the workflow instance). */
  gateId: string;
  /** The workflow run ID this gate belongs to. */
  workflowRunId: string;
  /** Role or user required to approve (empty = any authorised People user). */
  approverRole: string;
  /** Minutes before the gate auto-expires if no decision is made. */
  timeoutMinutes: number;
  /** Current status of the gate. */
  status: ApprovalStatus;
  /** ISO-8601 timestamp when the gate was created. */
  createdAt: string;
};

// ---------------------------------------------------------------------------
// BIZ-086 (#178) — Interview scheduling assistant approval gate
// ---------------------------------------------------------------------------

/** Interview format. */
export type InterviewFormat = "in_person" | "video_call" | "phone_screen" | "take_home" | "panel";

/** A single interview slot proposed by the scheduling assistant. */
export type InterviewSlot = {
  /** Interviewer name or ID. */
  interviewer: string;
  /** Interviewer's role (e.g. "engineering manager", "peer engineer"). */
  interviewerRole: string;
  /** Proposed start time (ISO-8601). */
  startTime: string;
  /** Duration in minutes. */
  durationMinutes: number;
  /** Interview format. */
  format: InterviewFormat;
  /** Meeting room or video link (if known). */
  location: string;
  /** Interview stage (e.g. "phone screen", "technical", "cultural fit", "final"). */
  stage: string;
};

/** Candidate details for the interview scheduling gate. */
export type InterviewCandidate = {
  /** Candidate full name. */
  name: string;
  /** Candidate email. */
  email: string;
  /** Position they are interviewing for. */
  position: string;
  /** Recruiting source (e.g. "referral", "LinkedIn", "careers page"). */
  source: string;
  /** Current stage in the hiring pipeline. */
  currentStage: string;
};

/**
 * Gate configuration for the interview scheduling assistant workflow.
 * The workflow analyses interviewer availability, candidate preferences,
 * and room/resource availability to propose an interview schedule. The
 * gate pauses so a recruiter can confirm the schedule before calendar
 * invites are sent.
 */
export type InterviewSchedulingGate = PeopleGateBase & {
  kind: "interview_scheduling";
  /** Candidate being scheduled. */
  candidate: InterviewCandidate;
  /** Proposed interview slots. */
  slots: InterviewSlot[];
  /** Whether all required interviewers have confirmed availability. */
  allInterviewersConfirmed: boolean;
  /** Any scheduling conflicts detected. */
  conflicts: string[];
  /** Timezone used for the schedule (IANA, e.g. "America/New_York"). */
  timezone: string;
};

// ---------------------------------------------------------------------------
// BIZ-089 (#181) — New hire paperwork checklist approval gate
// ---------------------------------------------------------------------------

/** Category of onboarding paperwork. */
export type PaperworkCategory =
  | "tax_forms"
  | "benefits_enrollment"
  | "nda_ip_agreement"
  | "direct_deposit"
  | "emergency_contact"
  | "handbook_acknowledgement"
  | "background_check_consent"
  | "equipment_agreement"
  | "other";

/** A single paperwork item in the new hire checklist. */
export type PaperworkItem = {
  /** Item identifier. */
  itemId: string;
  /** Human-readable name (e.g. "W-4 Federal Tax Withholding"). */
  name: string;
  /** Paperwork category. */
  category: PaperworkCategory;
  /** Whether the item has been completed by the new hire. */
  completed: boolean;
  /** Whether the item requires a wet/digital signature. */
  requiresSignature: boolean;
  /** Deadline for completion (ISO-8601). */
  deadline: string;
  /** Optional URL to the form or document. */
  documentUrl?: string;
};

/**
 * Gate configuration for the new hire paperwork checklist workflow.
 * The workflow generates a personalised paperwork checklist based on
 * the new hire's role, location, and employment type. The gate pauses
 * so an HR administrator can verify the checklist is complete and
 * accurate before the formal onboarding emails are dispatched.
 */
export type NewHirePaperworkGate = PeopleGateBase & {
  kind: "new_hire_paperwork";
  /** New hire full name. */
  employeeName: string;
  /** New hire email. */
  email: string;
  /** Job title. */
  jobTitle: string;
  /** Employment type. */
  employmentType: "full_time" | "part_time" | "contractor" | "intern";
  /** Work location (for jurisdiction-specific forms). */
  workLocation: string;
  /** Start date (ISO-8601). */
  startDate: string;
  /** Generated paperwork checklist. */
  items: PaperworkItem[];
  /** Count of items still pending. */
  pendingCount: number;
};

// ---------------------------------------------------------------------------
// Discriminated union of all People gates
// ---------------------------------------------------------------------------

/** Union of all People approval gate configurations. */
export type PeopleApprovalGate = InterviewSchedulingGate | NewHirePaperworkGate;
