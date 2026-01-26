/**
 * Internal trigger tool for scheduled check-ins.
 * Called by the cron agent to initiate check-in flows.
 */

import { Type } from "@sinclair/typebox";

import type { CheckinsStorage } from "../storage.js";
import { triggerCheckIn } from "../dm-handler.js";

/**
 * Create the internal trigger tool for cron-based check-ins.
 *
 * @param storage - CheckinsStorage instance
 * @param getAccountId - Function to get Discord account ID
 */
export function createTriggerTool(
  storage: CheckinsStorage,
  getAccountId?: () => string | undefined,
) {
  return {
    name: "checkins_trigger",
    description:
      "Internal tool for scheduled check-ins. Triggers a check-in flow for a specific member. " +
      "Only call this when instructed by the cron scheduler.",
    parameters: Type.Object({
      memberId: Type.String({ description: "Member UUID from the scheduler" }),
      teamId: Type.String({ description: "Team UUID from the scheduler" }),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const memberId = String(params.memberId).trim();
      const teamId = String(params.teamId).trim();

      if (!memberId || !teamId) {
        return {
          content: [{ type: "text", text: "Missing memberId or teamId" }],
          isError: true,
        };
      }

      const member = storage.getMember(memberId);
      if (!member) {
        return {
          content: [{ type: "text", text: `Member ${memberId} not found (may have been removed)` }],
        };
      }

      const team = storage.getTeam(teamId);
      if (!team) {
        return {
          content: [{ type: "text", text: `Team ${teamId} not found (may have been deleted)` }],
        };
      }

      try {
        await triggerCheckIn(storage, memberId, teamId, getAccountId?.());
        return {
          content: [
            {
              type: "text",
              text: `Check-in triggered for ${member.displayName ?? member.discordUserId}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to trigger check-in: ${String(err)}` }],
          isError: true,
        };
      }
    },
  };
}
