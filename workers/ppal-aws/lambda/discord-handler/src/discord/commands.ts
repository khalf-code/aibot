import {
  InteractionType,
  InteractionResponseType,
  APIApplicationCommandInteraction,
  APIChatInputApplicationCommandInteraction,
} from "discord-api-types/payloads/v10";
import { getUser } from "../services/dynamodb.js";
import { getGitHubToken } from "../services/secrets.js";

interface GitHubIssue {
  title: string;
  html_url: string;
  number: number;
}

/**
 * PING応答
 */
export function handlePing(): { type: InteractionResponseType.Pong } {
  return { type: InteractionResponseType.Pong };
}

/**
 * スラッシュコマンド処理
 */
export async function handleApplicationCommand(
  interaction: APIApplicationCommandInteraction
): Promise<{
  type: InteractionResponseType.ChannelMessageWithSource;
  data: { content: string; flags?: number };
}> {
  const chatInteraction = interaction as APIChatInputApplicationCommandInteraction;
  const { name } = chatInteraction.data;

  switch (name) {
    case "ppal":
      return await handlePpalCommand(chatInteraction);
    case "miyabi":
      return await handleMiyabiCommand(chatInteraction);
    case "help":
      return handleHelpCommand();
    default:
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Unknown command",
          flags: 64, // Ephemeral
        },
      };
  }
}

/**
 * /ppal コマンド
 */
async function handlePpalCommand(
  interaction: APIChatInputApplicationCommandInteraction
): Promise<{
  type: InteractionResponseType.ChannelMessageWithSource;
  data: { content: string; flags?: number };
}> {
  const options = interaction.data.options || [];
  const subcommand = options[0]?.name;

  switch (subcommand) {
    case "status":
      return handlePpalStatus(interaction);
    case "help":
      return handlePpalHelp();
    default:
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Unknown subcommand. Use `/ppal help` for info.",
          flags: 64,
        },
      };
  }
}

/**
 * /ppal status - システム状態確認
 */
async function handlePpalStatus(
  interaction: APIChatInputApplicationCommandInteraction
): Promise<{
  type: InteractionResponseType.ChannelMessageWithSource;
  data: { content: string; flags?: number };
}> {
  const user = await getUser(interaction.member?.user?.id || interaction.user?.id || "");

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: `
**PPAL System Status**

🟢 PPAL Discord Bot: Online
🟢 DynamoDB: Connected
🟢 Lambda: Active

${user ? `👤 User: ${user.username || interaction.member?.user?.username || "Unknown"}\n📊 State: ${user.state || "None"}` : "👤 User: Not registered"}

_Environment: ${process.env.ENVIRONMENT || "unknown"}_
      `.trim(),
      flags: 64, // Ephemeral
    },
  };
}

/**
 * /ppal help - ヘルプ表示
 */
function handlePpalHelp(): {
  type: InteractionResponseType.ChannelMessageWithSource;
  data: { content: string; flags?: number };
} {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: `
**PPAL Discord Bot Commands**

\`\`\`
/ppal status   - Show system status
/ppal help      - Show this help message

/miyabi issue <title>  - Create GitHub issue
/miyabi status         - Check Miyabi system status
/help                  - Show all commands
\`\`\`

🔗 [Documentation](https://docs.clawd.bot)
      `.trim(),
      flags: 64,
    },
  };
}

/**
 * /miyabi コマンド
 */
async function handleMiyabiCommand(
  interaction: APIChatInputApplicationCommandInteraction
): Promise<{
  type: InteractionResponseType.ChannelMessageWithSource;
  data: { content: string; flags?: number };
}> {
  const options = interaction.data.options || [];
  const subcommand = options[0]?.name;

  switch (subcommand) {
    case "issue":
      return await handleMiyabiIssue(interaction);
    case "status":
      return handleMiyabiStatus();
    default:
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Unknown subcommand. Use `/miyabi status` for info.",
          flags: 64,
        },
      };
  }
}

/**
 * /miyabi issue <title> - GitHub Issue作成
 */
async function handleMiyabiIssue(
  interaction: APIChatInputApplicationCommandInteraction
): Promise<{
  type: InteractionResponseType.ChannelMessageWithSource;
  data: { content: string; flags?: number };
}> {
  const options = interaction.data.options || [];
  const subcommandOptions = (options[0] as { options?: Array<{ value: unknown }> })?.options || [];
  const titleOption = subcommandOptions[0];
  const title = titleOption?.value as string;

  if (!title) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "❌ Please provide a title for the issue.",
        flags: 64,
      },
    };
  }

  try {
    const token = await getGitHubToken();
    const response = await fetch("https://api.github.com/repos/ShunsukeHayashi/clawdbot/issues", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: `[PPAL Discord] ${title}`,
        body: `Created from Discord by <@${interaction.member?.user?.id || interaction.user?.id}>\n\n---\n*This issue was automatically created via PPAL Discord Bot*`,
        labels: ["ppal", "discord-bot"],
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const issue = (await response.json()) as GitHubIssue;

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `✅ Issue created: [${issue.title}](${issue.html_url})\n\n📝 Issue #${issue.number}`,
        flags: 64,
      },
    };
  } catch (error) {
    console.error("Error creating GitHub issue:", error);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `❌ Failed to create issue: ${error instanceof Error ? error.message : "Unknown error"}`,
        flags: 64,
      },
    };
  }
}

/**
 * /miyabi status - Miyabi状態確認
 */
function handleMiyabiStatus(): {
  type: InteractionResponseType.ChannelMessageWithSource;
  data: { content: string; flags?: number };
} {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: `
**Miyabi Agent Society Status**

🎭 しきるん (Conductor): Online
🍁 カエデ (CodeGen): Online
🌸 サクラ (Review): Online
🌺 ツバキ (PR): Online
🌼 ボタン (Deploy): Online
🌊 ながれるん (Workflow): Online

📊 Active Agents: 6/6
_Environment: ${process.env.ENVIRONMENT || "unknown"}_
      `.trim(),
      flags: 64,
    },
  };
}

/**
 * /help コマンド
 */
function handleHelpCommand(): {
  type: InteractionResponseType.ChannelMessageWithSource;
  data: { content: string; flags?: number };
} {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: `
**PPAL Discord Bot - Command List**

\`\`\`
/ppal status   - Show PPAL system status
/ppal help      - Show PPAL commands

/miyabi issue <title>  - Create GitHub issue
/miyabi status         - Show Miyabi agent status

/help          - Show this message
\`\`\`

🔗 [Full Documentation](https://docs.clawd.bot)
💡 Need help? Join our community!
      `.trim(),
      flags: 64,
    },
  };
}
