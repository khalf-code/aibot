/**
 * UI-012 (#73) -- Notification settings UI
 *
 * Type definitions for the notification preferences view. Users can
 * configure which events trigger notifications, select delivery
 * channels, and set quiet hours.
 */

// ---------------------------------------------------------------------------
// Notification channels
// ---------------------------------------------------------------------------

/** A delivery channel for notifications. */
export type NotificationChannelType =
  | "email"
  | "slack"
  | "discord"
  | "telegram"
  | "webhook"
  | "in_app";

/** Configuration for a single notification delivery channel. */
export type NotificationChannel = {
  /** Channel type. */
  type: NotificationChannelType;
  /** Whether this channel is currently enabled. */
  enabled: boolean;
  /** Channel-specific destination (email address, webhook URL, channel ID, etc.). */
  destination: string;
  /** Display label for this channel instance. */
  label?: string;
  /** Whether delivery to this channel has been verified. */
  verified: boolean;
};

// ---------------------------------------------------------------------------
// Notification events
// ---------------------------------------------------------------------------

/** Events that can trigger a notification. */
export type NotificationEventType =
  | "run_completed"
  | "run_failed"
  | "approval_requested"
  | "approval_decided"
  | "secret_rotation_due"
  | "system_health_degraded"
  | "workflow_deployed"
  | "skill_deprecated";

/** Severity / importance of a notification. */
export type NotificationSeverity = "info" | "warning" | "critical";

// ---------------------------------------------------------------------------
// Notification rules
// ---------------------------------------------------------------------------

/** A rule that maps an event to one or more delivery channels. */
export type NotificationRule = {
  /** Unique rule identifier. */
  id: string;
  /** The event that triggers this notification. */
  event: NotificationEventType;
  /** Minimum severity required for this rule to fire. */
  minSeverity: NotificationSeverity;
  /** Channels to deliver this notification to. */
  channels: NotificationChannelType[];
  /** Whether this rule is currently enabled. */
  enabled: boolean;
  /** Optional filter: only fire for these skill names. Empty = all. */
  skillFilter?: string[];
  /** Optional filter: only fire for these environments. Empty = all. */
  environmentFilter?: string[];
};

// ---------------------------------------------------------------------------
// Quiet hours
// ---------------------------------------------------------------------------

/** Quiet hours configuration (suppress non-critical notifications). */
export type QuietHours = {
  /** Whether quiet hours are enabled. */
  enabled: boolean;
  /** Start time in `HH:MM` 24-hour format (e.g. `"22:00"`). */
  startTime: string;
  /** End time in `HH:MM` 24-hour format (e.g. `"08:00"`). */
  endTime: string;
  /** IANA timezone for interpreting start/end times (e.g. `"America/New_York"`). */
  timezone: string;
  /** Whether critical notifications bypass quiet hours. */
  allowCritical: boolean;
};

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

/** Complete notification preferences for a user. */
export type NotificationPreferences = {
  /** Configured delivery channels. */
  channels: NotificationChannel[];
  /** Notification rules (event-to-channel mappings). */
  rules: NotificationRule[];
  /** Quiet hours configuration. */
  quietHours: QuietHours;
  /** Global kill switch: when false, all notifications are suppressed. */
  globalEnabled: boolean;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default quiet hours (disabled). */
export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  startTime: "22:00",
  endTime: "08:00",
  timezone: "UTC",
  allowCritical: true,
};

/** Default notification preferences for a new user. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  channels: [{ type: "in_app", enabled: true, destination: "", verified: true }],
  rules: [
    {
      id: "default-run-failed",
      event: "run_failed",
      minSeverity: "warning",
      channels: ["in_app"],
      enabled: true,
    },
    {
      id: "default-approval",
      event: "approval_requested",
      minSeverity: "info",
      channels: ["in_app"],
      enabled: true,
    },
    {
      id: "default-health",
      event: "system_health_degraded",
      minSeverity: "critical",
      channels: ["in_app"],
      enabled: true,
    },
  ],
  quietHours: DEFAULT_QUIET_HOURS,
  globalEnabled: true,
};
