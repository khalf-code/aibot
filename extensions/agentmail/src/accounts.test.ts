import { describe, expect, it } from "vitest";

import { resolveAgentMailAccount, resolveCredentials } from "./accounts.js";
import type { CoreConfig } from "./utils.js";

describe("resolveCredentials", () => {
  it("resolves from config", () => {
    const cfg: CoreConfig = {
      channels: {
        agentmail: {
          token: "am_config_token",
          emailAddress: "inbox@agentmail.to",
        },
      },
    };
    const result = resolveCredentials(cfg, {});
    expect(result.apiKey).toBe("am_config_token");
    expect(result.inboxId).toBe("inbox@agentmail.to");
  });

  it("falls back to environment variables", () => {
    const cfg: CoreConfig = {};
    const env = {
      AGENTMAIL_TOKEN: "am_env_token",
      AGENTMAIL_EMAIL_ADDRESS: "env@agentmail.to",
    };
    const result = resolveCredentials(cfg, env);
    expect(result.apiKey).toBe("am_env_token");
    expect(result.inboxId).toBe("env@agentmail.to");
  });

  it("config takes precedence over env", () => {
    const cfg: CoreConfig = {
      channels: {
        agentmail: {
          token: "am_config_token",
          emailAddress: "config@agentmail.to",
        },
      },
    };
    const env = {
      AGENTMAIL_TOKEN: "am_env_token",
      AGENTMAIL_EMAIL_ADDRESS: "env@agentmail.to",
    };
    const result = resolveCredentials(cfg, env);
    expect(result.apiKey).toBe("am_config_token");
    expect(result.inboxId).toBe("config@agentmail.to");
  });

  it("returns undefined for missing credentials", () => {
    const cfg: CoreConfig = {};
    const result = resolveCredentials(cfg, {});
    expect(result.apiKey).toBeUndefined();
    expect(result.inboxId).toBeUndefined();
  });
});

describe("resolveAgentMailAccount", () => {
  it("resolves configured account", () => {
    const cfg: CoreConfig = {
      channels: {
        agentmail: {
          name: "My Email",
          enabled: true,
          token: "am_token",
          emailAddress: "inbox@agentmail.to",
        },
      },
    };
    const result = resolveAgentMailAccount({ cfg });
    expect(result.accountId).toBe("default");
    expect(result.name).toBe("My Email");
    expect(result.enabled).toBe(true);
    expect(result.configured).toBe(true);
    expect(result.inboxId).toBe("inbox@agentmail.to");
  });

  it("returns configured=false when missing token", () => {
    const cfg: CoreConfig = {
      channels: {
        agentmail: {
          emailAddress: "inbox@agentmail.to",
        },
      },
    };
    const result = resolveAgentMailAccount({ cfg });
    expect(result.configured).toBe(false);
  });

  it("returns configured=false when missing emailAddress", () => {
    const cfg: CoreConfig = {
      channels: {
        agentmail: {
          token: "am_token",
        },
      },
    };
    const result = resolveAgentMailAccount({ cfg });
    expect(result.configured).toBe(false);
  });

  it("defaults enabled to true", () => {
    const cfg: CoreConfig = {
      channels: {
        agentmail: {},
      },
    };
    const result = resolveAgentMailAccount({ cfg });
    expect(result.enabled).toBe(true);
  });

  it("respects enabled=false", () => {
    const cfg: CoreConfig = {
      channels: {
        agentmail: {
          enabled: false,
        },
      },
    };
    const result = resolveAgentMailAccount({ cfg });
    expect(result.enabled).toBe(false);
  });

  it("trims name whitespace", () => {
    const cfg: CoreConfig = {
      channels: {
        agentmail: {
          name: "  Trimmed Name  ",
        },
      },
    };
    const result = resolveAgentMailAccount({ cfg });
    expect(result.name).toBe("Trimmed Name");
  });
});
