import type { OnboardOptions } from "../commands/onboard-types.js";
import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "./prompts.js";
import { readConfigFileSnapshot, writeConfigFile, resolveGatewayPort } from "../config/config.js";
import { logConfigUpdated } from "../config/logging.js";
import { defaultRuntime } from "../runtime.js";

type WebConfigureSection = "gateway" | "web-tools";

type WizardRunOpts = OnboardOptions & { wizard?: "onboarding" | "configure" };

function clampPort(n: number) {
  if (!Number.isFinite(n)) return 18789;
  if (n < 1) return 18789;
  if (n > 65535) return 18789;
  return Math.floor(n);
}

export async function runConfigureWizardWeb(
  _opts: WizardRunOpts,
  runtime: RuntimeEnv = defaultRuntime,
  prompter: WizardPrompter,
) {
  await prompter.intro("OpenClaw configure");

  const snapshot = await readConfigFileSnapshot();
  const baseConfig: OpenClawConfig = snapshot.valid ? snapshot.config : {};

  if (snapshot.exists && !snapshot.valid) {
    await prompter.note(
      [
        "Your config file exists but is invalid.",
        "Run `openclaw doctor --fix` in the CLI once to repair it, then come back here.",
        "Docs: https://docs.openclaw.ai/gateway/configuration",
      ].join("\n"),
      "Config invalid",
    );
    await prompter.outro("Cannot continue until config is valid.");
    runtime.exit(1);
    return;
  }

  const sections = await prompter.multiselect<WebConfigureSection>({
    message: "What do you want to configure now?",
    options: [
      { value: "gateway", label: "Gateway", hint: "Port, bind, auth" },
      { value: "web-tools", label: "Web tools", hint: "web_fetch + web_search" },
    ],
    initialValues: ["gateway", "web-tools"],
  });

  let next = structuredClone(baseConfig);

  if (sections.includes("gateway")) {
    const portStr = await prompter.text({
      message: "Gateway port",
      initialValue: String(resolveGatewayPort(next)),
      validate: (val) => (Number.isFinite(Number(val)) ? undefined : "Invalid port"),
    });
    const port = clampPort(Number.parseInt(portStr, 10));

    const bind = await prompter.select({
      message: "Gateway bind",
      options: [
        { value: "loopback", label: "Local only (recommended)", hint: "127.0.0.1" },
        { value: "lan", label: "LAN (advanced)", hint: "0.0.0.0" },
      ],
      initialValue: (next.gateway?.bind === "lan" ? "lan" : "loopback") as any,
    });

    const authMode = await prompter.select({
      message: "Gateway auth",
      options: [
        { value: "token", label: "Token" },
        { value: "password", label: "Password" },
      ],
      initialValue: (next.gateway?.auth?.mode === "password" ? "password" : "token") as any,
    });

    let auth: any = { ...(next.gateway?.auth ?? {}) };

    if (authMode === "token") {
      const token = await prompter.text({
        message: "Gateway token",
        initialValue: String(next.gateway?.auth?.token ?? ""),
        placeholder: "Paste token",
        validate: (v) => (v.trim() ? undefined : "Required"),
      });
      auth = { mode: "token", token: token.trim() };
    }

    if (authMode === "password") {
      const password = await prompter.text({
        message: "Gateway password",
        initialValue: "",
        placeholder: "Set a password",
        validate: (v) => (v.trim() ? undefined : "Required"),
      });
      auth = { mode: "password", password: password.trim() };
    }

    next = {
      ...next,
      gateway: {
        ...next.gateway,
        mode: "local",
        port,
        bind,
        auth,
      },
    };
  }

  if (sections.includes("web-tools")) {
    const enableFetch = await prompter.confirm({
      message: "Enable web_fetch (keyless HTTP fetch)?",
      initialValue: next.tools?.web?.fetch?.enabled ?? true,
    });

    const enableSearch = await prompter.confirm({
      message: "Enable web_search (Brave Search)?",
      initialValue: next.tools?.web?.search?.enabled ?? false,
    });

    let apiKey: string | undefined = next.tools?.web?.search?.apiKey;
    if (enableSearch) {
      const key = await prompter.text({
        message: "Brave Search API key (optional if BRAVE_API_KEY is set)",
        initialValue: apiKey ? "" : "",
        placeholder: apiKey ? "Leave blank to keep current" : "BSA...",
      });
      if (key.trim()) apiKey = key.trim();
    }

    next = {
      ...next,
      tools: {
        ...next.tools,
        web: {
          ...next.tools?.web,
          fetch: {
            ...next.tools?.web?.fetch,
            enabled: enableFetch,
          },
          search: {
            ...next.tools?.web?.search,
            enabled: enableSearch,
            ...(apiKey ? { apiKey } : {}),
          },
        },
      },
    };

    if (enableSearch && !apiKey) {
      await prompter.note(
        [
          "web_search is enabled but no API key is stored.",
          "Set BRAVE_API_KEY in the Gateway environment, or re-run this wizard and paste the key.",
          "Docs: https://docs.openclaw.ai/tools/web",
        ].join("\n"),
        "Web search",
      );
    }
  }

  await writeConfigFile(next);
  logConfigUpdated(runtime);

  await prompter.outro("Saved. You can re-run Configure anytime from the UI.");
}
