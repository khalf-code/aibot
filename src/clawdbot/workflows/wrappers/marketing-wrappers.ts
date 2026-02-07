/**
 * Marketing workflow wrapper types — Business Skill Packs
 *
 * Covers:
 *   - BIZ-078 (#170) Compile weekly content ideas workflow wrapper
 *   - BIZ-081 (#173) Generate newsletter draft workflow wrapper
 *   - BIZ-084 (#176) Social post scheduling prep workflow wrapper
 *
 * Each wrapper type defines the orchestration shape for its Marketing
 * workflow, including inputs, outputs, step definitions, and execution state.
 */

import type {
  MarketingChannel,
  ContentIdea,
  NewsletterSection,
  SocialPost,
} from "../gates/marketing-gates.js";
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

/** Common fields shared by all Marketing workflow wrappers. */
export type MarketingWrapperBase = {
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
// BIZ-078 (#170) — Compile weekly content ideas workflow wrapper
// ---------------------------------------------------------------------------

/** Step identifiers for the weekly content ideas workflow. */
export type WeeklyContentIdeasStep =
  | "fetch_trending_topics"
  | "analyse_past_performance"
  | "gather_team_input"
  | "compile_ideas"
  | "rank_and_prioritise"
  | "approval_gate"
  | "publish_to_calendar"
  | "notify_team";

/** Input parameters for the weekly content ideas workflow. */
export type WeeklyContentIdeasInput = {
  /** ISO-8601 week start date (Monday). */
  weekStartDate: string;
  /** Channels to consider for content ideas. */
  targetChannels: MarketingChannel[];
  /** Maximum number of ideas to compile. */
  maxIdeas: number;
  /** Whether to include competitor analysis. */
  includeCompetitorAnalysis: boolean;
  /** Notification channel for the team. */
  notificationChannel: string;
};

/** Output produced by the weekly content ideas workflow. */
export type WeeklyContentIdeasOutput = {
  /** Compiled and ranked content ideas. */
  ideas: ContentIdea[];
  /** Trending topics that informed the ideas. */
  trendingTopics: string[];
  /** Top-performing content from the previous week. */
  previousWeekTopContent: string;
  /** URL to the updated editorial calendar. */
  calendarUrl: string;
  /** Summary message for team notification. */
  summaryMessage: string;
};

/**
 * Workflow wrapper for compiling weekly content ideas.
 * Orchestrates fetching trending topics, analysing past content
 * performance, gathering team input, compiling and ranking ideas,
 * gating on marketing lead approval, then publishing approved
 * ideas to the editorial calendar.
 */
export type WeeklyContentIdeasWrapper = MarketingWrapperBase & {
  kind: "weekly_content_ideas";
  input: WeeklyContentIdeasInput;
  output?: WeeklyContentIdeasOutput;
  currentStep: WeeklyContentIdeasStep;
};

// ---------------------------------------------------------------------------
// BIZ-081 (#173) — Generate newsletter draft workflow wrapper
// ---------------------------------------------------------------------------

/** Step identifiers for the newsletter draft workflow. */
export type NewsletterDraftStep =
  | "gather_content_sources"
  | "curate_sections"
  | "generate_draft"
  | "apply_template"
  | "approval_gate"
  | "queue_for_send"
  | "notify_editor";

/** Input parameters for the newsletter draft workflow. */
export type NewsletterDraftInput = {
  /** Newsletter edition label (e.g. "Weekly Digest #42"). */
  editionLabel: string;
  /** Target send date (ISO-8601). */
  scheduledSendDate: string;
  /** Subscriber segment to target. */
  targetSegment: string;
  /** Content sources to pull from (URLs, RSS feeds, etc.). */
  contentSourceUrls: string[];
  /** Maximum number of sections. */
  maxSections: number;
  /** Brand voice / tone guidance. */
  toneGuidance: string;
};

/** Output produced by the newsletter draft workflow. */
export type NewsletterDraftOutput = {
  /** Generated subject line. */
  subjectLine: string;
  /** Preview / preheader text. */
  previewText: string;
  /** Newsletter sections. */
  sections: NewsletterSection[];
  /** Estimated recipient count. */
  estimatedRecipientCount: number;
  /** URL to preview the rendered newsletter. */
  previewUrl: string;
  /** Summary message for editor notification. */
  summaryMessage: string;
};

/**
 * Workflow wrapper for generating a newsletter draft.
 * Orchestrates gathering content from configured sources, curating
 * sections, generating the draft with AI, applying the brand template,
 * gating on editor approval, then queuing the newsletter for send.
 */
export type NewsletterDraftWrapper = MarketingWrapperBase & {
  kind: "newsletter_draft";
  input: NewsletterDraftInput;
  output?: NewsletterDraftOutput;
  currentStep: NewsletterDraftStep;
};

// ---------------------------------------------------------------------------
// BIZ-084 (#176) — Social post scheduling prep workflow wrapper
// ---------------------------------------------------------------------------

/** Step identifiers for the social post scheduling workflow. */
export type SocialPostSchedulingStep =
  | "fetch_editorial_calendar"
  | "generate_copy"
  | "select_media"
  | "optimise_timing"
  | "approval_gate"
  | "queue_in_scheduler"
  | "notify_social_manager";

/** Input parameters for the social post scheduling workflow. */
export type SocialPostSchedulingInput = {
  /** ISO-8601 date range start for the scheduling window. */
  windowStart: string;
  /** ISO-8601 date range end for the scheduling window. */
  windowEnd: string;
  /** Channels to prepare posts for. */
  targetChannels: MarketingChannel[];
  /** Maximum posts per channel per day. */
  maxPostsPerChannelPerDay: number;
  /** Whether to include promotional posts. */
  includePromotional: boolean;
  /** Brand voice / tone guidance. */
  toneGuidance: string;
};

/** Output produced by the social post scheduling workflow. */
export type SocialPostSchedulingOutput = {
  /** Prepared social posts. */
  posts: SocialPost[];
  /** Total number of posts queued. */
  totalQueued: number;
  /** Channels included in the batch. */
  channelsIncluded: MarketingChannel[];
  /** URL to the scheduling dashboard. */
  schedulerUrl: string;
  /** Summary message for social manager notification. */
  summaryMessage: string;
};

/**
 * Workflow wrapper for social post scheduling preparation.
 * Orchestrates fetching the editorial calendar, generating copy
 * for each platform, selecting media assets, optimising post timing,
 * gating on social media manager approval, then queuing posts
 * in the scheduling tool.
 */
export type SocialPostSchedulingWrapper = MarketingWrapperBase & {
  kind: "social_post_scheduling";
  input: SocialPostSchedulingInput;
  output?: SocialPostSchedulingOutput;
  currentStep: SocialPostSchedulingStep;
};

// ---------------------------------------------------------------------------
// Discriminated union of all Marketing wrappers
// ---------------------------------------------------------------------------

/** Union of all Marketing workflow wrapper configurations. */
export type MarketingWorkflowWrapper =
  | WeeklyContentIdeasWrapper
  | NewsletterDraftWrapper
  | SocialPostSchedulingWrapper;
