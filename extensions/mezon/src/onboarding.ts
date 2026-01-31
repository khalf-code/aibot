/**
 * Mezon onboarding and setup wizard.
 */
import type {
  ChannelOnboardingAdapter,
  ChannelOnboardingDmPolicy,
  OpenClawConfig,
  WizardPrompter,
} from "openclaw/plugin-sdk";
import {
  addWildcardAllowFrom,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  promptAccountId,
} from "openclaw/plugin-sdk";

import {
  listMezonAccountIds,
  resolveDefaultMezonAccountId,
  resolveMezonAccount,
} from "./accounts.js";

const channel = "mezon" as const;

/** Set Mezon DM policy in config. */
function setMezonDmPolicy(
  cfg: OpenClawConfig,
  dmPolicy: "pairing" | "allowlist" | "open" | "disabled",
): OpenClawConfig {
  const allowFrom = dmPolicy === "open" ? addWildcardAllowFrom(cfg.channels?.mezon?.allowFrom) : undefined;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      mezon: { ...cfg.channels?.mezon, dmPolicy, ...(allowFrom ? { allowFrom } : {}) },
    },
  } as OpenClawConfig;
}

/** Show help text for obtaining Mezon bot credentials. */
async function showCredentialsHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "1) Go to Mezon Developer Portal: https://mezon.ai/",
      "2) Create a bot application and get your Bot ID and Token",
      "3) Bot ID example: 1840692863290052608",
      "4) Token example: 0D1z193jsxQFZ",
      "Tip: Set MEZON_BOT_ID and MEZON_BOT_TOKEN env vars",
      "Docs: https://mezon.ai/docs/en/developer/mezon-sdk/integration-bot-sdk",
    ].join("\n"),
    "Mezon credentials",
  );
}

/** Prompt for Mezon user ID to add to allowFrom list. */
async function promptAllowFrom(
  cfg: OpenClawConfig,
  prompter: WizardPrompter,
  accountId: string,
): Promise<OpenClawConfig> {
  const account = resolveMezonAccount({ cfg, accountId });
  const existing = account.config.allowFrom ?? [];
  
  const userId = await prompter.text({
    message: "Mezon user ID to allow",
    placeholder: "1833682843671203840",
    initialValue: existing[0] ? String(existing[0]) : undefined,
    validate: (value) => {
      const v = String(value ?? "").trim();
      return !v ? "Required" : !/^\d+$/.test(v) ? "Must be a valid Mezon user ID" : undefined;
    },
  });

  const unique = [...new Set([...existing.map(String).filter(Boolean), String(userId).trim()])];
  const baseConfig = { ...cfg.channels?.mezon, enabled: true, dmPolicy: "allowlist", allowFrom: unique };

  if (accountId === DEFAULT_ACCOUNT_ID) {
    return { ...cfg, channels: { ...cfg.channels, mezon: baseConfig } } as OpenClawConfig;
  }

  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      mezon: {
        ...baseConfig,
        accounts: {
          ...cfg.channels?.mezon?.accounts,
          [accountId]: { ...cfg.channels?.mezon?.accounts?.[accountId], ...baseConfig },
        },
      },
    },
  } as OpenClawConfig;
}

/** DM policy configuration for onboarding. */
const dmPolicy: ChannelOnboardingDmPolicy = {
  label: "Mezon",
  channel,
  policyKey: "channels.mezon.dmPolicy",
  allowFromKey: "channels.mezon.allowFrom",
  getCurrent: (cfg) => (cfg.channels?.mezon?.dmPolicy ?? "pairing") as "pairing",
  setPolicy: setMezonDmPolicy,
  promptAllowFrom: async ({ cfg, prompter, accountId }) => {
    const id = accountId && normalizeAccountId(accountId)
      ? normalizeAccountId(accountId) ?? DEFAULT_ACCOUNT_ID
      : resolveDefaultMezonAccountId(cfg as OpenClawConfig);
    return promptAllowFrom(cfg as OpenClawConfig, prompter, id);
  },
};

/**
 * Mezon onboarding adapter for interactive setup.
 */
export const mezonOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  dmPolicy,
  getStatus: async ({ cfg }) => {
    const configured = listMezonAccountIds(cfg as OpenClawConfig).some((accountId) => {
      const account = resolveMezonAccount({ cfg: cfg as OpenClawConfig, accountId });
      return Boolean(account.token && account.botId);
    });
    return {
      channel,
      configured,
      statusLines: [`Mezon: ${configured ? "configured" : "needs credentials"}`],
      selectionHint: configured ? "recommended · configured" : "recommended",
      quickstartScore: configured ? 1 : 10,
    };
  },
  configure: async ({ cfg, prompter, accountOverrides, shouldPromptAccountIds, forceAllowFrom }) => {
    let next = cfg as OpenClawConfig;
    
    // Determine account ID
    let accountId = accountOverrides.mezon?.trim()
      ? normalizeAccountId(accountOverrides.mezon.trim())
      : resolveDefaultMezonAccountId(next);

    if (shouldPromptAccountIds && !accountOverrides.mezon) {
      accountId = await promptAccountId({
        cfg: next,
        prompter,
        label: "Mezon",
        currentId: accountId,
        listAccountIds: listMezonAccountIds,
        defaultAccountId: resolveDefaultMezonAccountId(next),
      });
    }

    const account = resolveMezonAccount({ cfg: next, accountId });
    const hasCredentials = Boolean(account.token && account.botId);
    const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
    const canUseEnv = allowEnv && Boolean(process.env.MEZON_BOT_TOKEN && process.env.MEZON_BOT_ID);

    let botId: string | null = null;
    let token: string | null = null;

    // Prompt for credentials if needed
    if (!hasCredentials) {
      await showCredentialsHelp(prompter);
    }

    if (canUseEnv && !account.config.botToken) {
      const keepEnv = await prompter.confirm({
        message: "Use MEZON_BOT_ID and MEZON_BOT_TOKEN from env?",
        initialValue: true,
      });
      
      if (!keepEnv) {
        botId = String(await prompter.text({ message: "Bot ID", validate: (v) => v?.trim() ? undefined : "Required" })).trim();
        token = String(await prompter.text({ message: "Bot token", validate: (v) => v?.trim() ? undefined : "Required" })).trim();
      }
    } else if (hasCredentials) {
      const keep = await prompter.confirm({
        message: "Mezon credentials already configured. Keep?",
        initialValue: true,
      });
      
      if (!keep) {
        botId = String(await prompter.text({ message: "Bot ID", validate: (v) => v?.trim() ? undefined : "Required" })).trim();
        token = String(await prompter.text({ message: "Bot token", validate: (v) => v?.trim() ? undefined : "Required" })).trim();
      }
    } else {
      botId = String(await prompter.text({ message: "Bot ID", placeholder: "1840692863290052608", validate: (v) => v?.trim() ? undefined : "Required" })).trim();
      token = String(await prompter.text({ message: "Bot token", validate: (v) => v?.trim() ? undefined : "Required" })).trim();
    }

    // Save credentials to config
    if (botId && token) {
      const credentials = { enabled: true, botId, botToken: token };
      
      if (accountId === DEFAULT_ACCOUNT_ID) {
        next = {
          ...next,
          channels: { ...next.channels, mezon: { ...next.channels?.mezon, ...credentials } },
        } as OpenClawConfig;
      } else {
        next = {
          ...next,
          channels: {
            ...next.channels,
            mezon: {
              ...next.channels?.mezon,
              enabled: true,
              accounts: {
                ...next.channels?.mezon?.accounts,
                [accountId]: { ...next.channels?.mezon?.accounts?.[accountId], ...credentials },
              },
            },
          },
        } as OpenClawConfig;
      }
    }

    // Optionally prompt for allowFrom
    if (forceAllowFrom) {
      next = await promptAllowFrom(next, prompter, accountId);
    }

    return { cfg: next, accountId };
  },
};
