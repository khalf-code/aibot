/**
 * Help tool for the check-ins extension.
 * Provides usage information and available commands.
 */

import { Type } from "@sinclair/typebox";

/**
 * Create the help tool for the checkins extension.
 */
export function createHelpTool() {
  return {
    name: "checkins_help",
    description:
      "Get help and usage information for the check-ins extension. " +
      "Shows available commands, how to set up teams, and how check-ins work.",
    parameters: Type.Object({
      topic: Type.Optional(
        Type.String({
          description:
            "Specific topic: 'teams', 'members', 'schedule', 'vacation', or leave empty for overview",
        }),
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const topic = params.topic ? String(params.topic).toLowerCase().trim() : "";

      if (topic === "teams") {
        return {
          content: [
            {
              type: "text",
              text: `**Team Management**

• **Create a team**: "Create a team called [name] in channel #[channel]"
• **Delete a team**: "Delete the [name] team"
• **List teams**: "Show all teams" or "List teams"

Teams are linked to a Discord server (configured in clawdbot.json) and post check-ins to a specific channel.`,
            },
          ],
        };
      }

      if (topic === "members") {
        return {
          content: [
            {
              type: "text",
              text: `**Member Management**

• **Add a member**: "Add @user to [team] with timezone [tz]"
• **Remove a member**: "Remove @user from [team]"
• **List members**: "Show members of [team]"
• **Change timezone**: "Set @user's timezone to [tz]"

Supported timezone formats: "America/New_York", "EST", "Eastern", "Australia/Melbourne", "AEST", etc.

Each member can only be on one team per server.`,
            },
          ],
        };
      }

      if (topic === "schedule") {
        return {
          content: [
            {
              type: "text",
              text: `**Check-in Schedule**

• Default check-in time: 5:00 PM in the member's timezone
• Check-ins are skipped on weekends (Saturday/Sunday in member's timezone)
• Each member gets a DM with 3 questions:
  1. What did you work on today?
  2. What are you planning to work on next?
  3. Any blockers or things you need help with?

• Completed check-ins are posted to the team's channel
• Manual check-in: DM the bot with "checkin" or "standup"`,
            },
          ],
        };
      }

      if (topic === "vacation") {
        return {
          content: [
            {
              type: "text",
              text: `**Vacation Mode**

• **Set vacation**: "Set @user on vacation until [date]"
• **End vacation**: "End @user's vacation"

While on vacation, scheduled check-ins are skipped. Members can still do manual check-ins if they want.

Date formats: "January 15", "2024-01-15", "next Monday", "in 2 weeks"`,
            },
          ],
        };
      }

      // Default overview
      return {
        content: [
          {
            type: "text",
            text: `**Check-ins Extension Help**

Daily standup check-ins via Discord DM. Members receive questions at their scheduled time and responses are posted to the team channel.

**Topics** (ask "checkins help [topic]"):
• \`teams\` - Creating and managing teams
• \`members\` - Adding/removing team members
• \`schedule\` - How check-in scheduling works
• \`vacation\` - Setting vacation mode

**Quick Start**:
1. Create a team: "Create a team called Engineering in #standups"
2. Add members: "Add @alice to Engineering with timezone America/New_York"
3. Members will receive DMs at 5 PM their time

**Manual Check-in**:
DM the bot with "checkin" or "standup" to start a check-in anytime.`,
          },
        ],
      };
    },
  };
}
