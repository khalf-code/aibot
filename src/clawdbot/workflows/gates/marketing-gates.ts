/**
 * Marketing approval gate types — Business Skill Packs
 *
 * Covers:
 *   - BIZ-077 (#169) Compile weekly content ideas approval gate
 *   - BIZ-080 (#172) Generate newsletter draft approval gate
 *   - BIZ-083 (#175) Social post scheduling prep approval gate
 *
 * Each gate configuration defines the approval parameters for its
 * corresponding Marketing workflow. Gates are evaluated by the
 * Clawdbot Approval Gate node (WF-005) at runtime.
 */

import type { ApprovalStatus } from "../approval-node.js";

// ---------------------------------------------------------------------------
// Shared Marketing gate types
// ---------------------------------------------------------------------------

/** Content status used across Marketing gates. */
export type ContentStatus = "draft" | "in_review" | "approved" | "published" | "rejected";

/** Marketing channels targeted by content. */
export type MarketingChannel =
  | "blog"
  | "email"
  | "twitter"
  | "linkedin"
  | "facebook"
  | "instagram"
  | "youtube"
  | "tiktok"
  | "podcast"
  | "other";

/** Common fields shared by all Marketing approval gate configurations. */
export type MarketingGateBase = {
  /** Unique gate identifier (scoped to the workflow instance). */
  gateId: string;
  /** The workflow run ID this gate belongs to. */
  workflowRunId: string;
  /** Role or user required to approve (empty = any authorised Marketing user). */
  approverRole: string;
  /** Minutes before the gate auto-expires if no decision is made. */
  timeoutMinutes: number;
  /** Current status of the gate. */
  status: ApprovalStatus;
  /** ISO-8601 timestamp when the gate was created. */
  createdAt: string;
};

// ---------------------------------------------------------------------------
// BIZ-077 (#169) — Compile weekly content ideas approval gate
// ---------------------------------------------------------------------------

/** A single content idea proposed for the week. */
export type ContentIdea = {
  /** Short title or headline for the idea. */
  title: string;
  /** Brief description of the topic or angle. */
  description: string;
  /** Target channel(s) for this idea. */
  channels: MarketingChannel[];
  /** Estimated effort to produce (hours). */
  estimatedEffortHours: number;
  /** Keywords or themes for SEO/discoverability. */
  keywords: string[];
  /** Source of the idea (e.g. "trending topics", "customer feedback", "team brainstorm"). */
  source: string;
};

/**
 * Gate configuration for the weekly content ideas compilation workflow.
 * The workflow gathers trending topics, past performance data, and team
 * input to compile a list of content ideas. The gate pauses so a
 * marketing lead can review and prioritise before the ideas move to
 * the editorial calendar.
 */
export type WeeklyContentIdeasGate = MarketingGateBase & {
  kind: "weekly_content_ideas";
  /** ISO-8601 week start date (Monday). */
  weekStartDate: string;
  /** Compiled list of content ideas for review. */
  ideas: ContentIdea[];
  /** Number of content pieces published the previous week (context). */
  previousWeekPublishedCount: number;
  /** Top-performing content topic from the previous week. */
  previousWeekTopTopic: string;
};

// ---------------------------------------------------------------------------
// BIZ-080 (#172) — Generate newsletter draft approval gate
// ---------------------------------------------------------------------------

/** A section within the newsletter draft. */
export type NewsletterSection = {
  /** Section heading. */
  heading: string;
  /** Body content (Markdown). */
  bodyMarkdown: string;
  /** Optional call-to-action URL. */
  ctaUrl?: string;
  /** Optional call-to-action button text. */
  ctaText?: string;
  /** Position order within the newsletter (1-based). */
  order: number;
};

/**
 * Gate configuration for the newsletter draft generation workflow.
 * The workflow auto-generates a newsletter draft from curated content,
 * recent blog posts, and product updates. The gate pauses so a
 * marketing editor can review tone, accuracy, and formatting before
 * the newsletter is queued for send.
 */
export type NewsletterDraftGate = MarketingGateBase & {
  kind: "newsletter_draft";
  /** Newsletter subject line. */
  subjectLine: string;
  /** Preview text (email preheader). */
  previewText: string;
  /** Sections composing the newsletter body. */
  sections: NewsletterSection[];
  /** Target send date (ISO-8601). */
  scheduledSendDate: string;
  /** Subscriber segment this edition targets. */
  targetSegment: string;
  /** Estimated subscriber count for the target segment. */
  estimatedRecipientCount: number;
};

// ---------------------------------------------------------------------------
// BIZ-083 (#175) — Social post scheduling prep approval gate
// ---------------------------------------------------------------------------

/** A single social media post ready for scheduling. */
export type SocialPost = {
  /** Target platform. */
  channel: MarketingChannel;
  /** Post copy / caption. */
  body: string;
  /** Scheduled publish time (ISO-8601). */
  scheduledAt: string;
  /** Media attachment URLs (images, videos). */
  mediaUrls: string[];
  /** Hashtags to include. */
  hashtags: string[];
  /** Whether this is a reply or thread continuation. */
  isReply: boolean;
  /** Link to the content being promoted (if applicable). */
  promotedUrl?: string;
};

/**
 * Gate configuration for the social post scheduling prep workflow.
 * The workflow prepares a batch of social media posts (copy, media,
 * timing) based on the editorial calendar. The gate pauses so a
 * social media manager can review voice, timing, and platform fit
 * before the posts are queued in the scheduling tool.
 */
export type SocialPostSchedulingGate = MarketingGateBase & {
  kind: "social_post_scheduling";
  /** Batch of posts prepared for scheduling. */
  posts: SocialPost[];
  /** ISO-8601 date range start for the scheduling window. */
  windowStart: string;
  /** ISO-8601 date range end for the scheduling window. */
  windowEnd: string;
  /** Total number of posts in the batch. */
  totalPostCount: number;
  /** Channels included in this batch. */
  channelsIncluded: MarketingChannel[];
};

// ---------------------------------------------------------------------------
// Discriminated union of all Marketing gates
// ---------------------------------------------------------------------------

/** Union of all Marketing approval gate configurations. */
export type MarketingApprovalGate =
  | WeeklyContentIdeasGate
  | NewsletterDraftGate
  | SocialPostSchedulingGate;
