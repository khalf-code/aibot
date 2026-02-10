import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import type { OpenClawConfig } from "../config/config.js";
import { checkGuideTasks } from "./guide.js";

vi.mock("node:fs");
vi.mock("../config/sessions/paths.js", () => ({
  resolveSessionTranscriptsDir: () => "/mock-state/agents/main/sessions",
}));

const mockedFs = vi.mocked(fs);

function makeConfig(overrides: Partial<OpenClawConfig> = {}): OpenClawConfig {
  return {
    agents: { defaults: { model: { primary: "anthropic/claude-sonnet-4-20250514" } } },
    channels: {},
    skills: { install: [] },
    ...overrides,
  } as OpenClawConfig;
}

const TEMPLATE_IDENTITY = `# IDENTITY.md - Who Am I?

- **Name:**
  _(pick something you like)_
- **Creature:**
  _(AI? robot? familiar? ghost in the machine? something weirder?)_
- **Vibe:**
  _(how do you come across? sharp? warm? chaotic? calm?)_
`;

const CUSTOMIZED_IDENTITY = `# IDENTITY.md - Who Am I?

- **Name:** Clawdia
- **Creature:** AI familiar
- **Vibe:** warm and curious
`;

describe("checkGuideTasks - identity", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns false for untouched template identity", () => {
    mockedFs.existsSync.mockImplementation((p) => {
      if (String(p).endsWith("IDENTITY.md")) return true;
      return false;
    });
    mockedFs.readFileSync.mockReturnValue(TEMPLATE_IDENTITY);

    const result = checkGuideTasks(makeConfig(), "/workspace");
    const identity = result.tasks.find((t) => t.task.id === "identity");
    expect(identity?.completed).toBe(false);
  });

  it("returns true for customized identity", () => {
    mockedFs.existsSync.mockImplementation((p) => {
      if (String(p).endsWith("IDENTITY.md")) return true;
      return false;
    });
    mockedFs.readFileSync.mockReturnValue(CUSTOMIZED_IDENTITY);

    const result = checkGuideTasks(makeConfig(), "/workspace");
    const identity = result.tasks.find((t) => t.task.id === "identity");
    expect(identity?.completed).toBe(true);
  });

  it("returns false when Name field is empty", () => {
    const emptyName = `# IDENTITY.md\n\n- **Name:**\n- **Creature:** something\n`;
    mockedFs.existsSync.mockImplementation((p) => {
      if (String(p).endsWith("IDENTITY.md")) return true;
      return false;
    });
    mockedFs.readFileSync.mockReturnValue(emptyName);

    const result = checkGuideTasks(makeConfig(), "/workspace");
    const identity = result.tasks.find((t) => t.task.id === "identity");
    expect(identity?.completed).toBe(false);
  });
});

describe("checkGuideTasks - first-message (session transcripts)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("uses resolveSessionTranscriptsDir path, not workspace-relative", () => {
    mockedFs.existsSync.mockImplementation((p) => {
      if (String(p) === "/mock-state/agents/main/sessions") return true;
      return false;
    });
    mockedFs.readdirSync.mockReturnValue(["abc123.jsonl"] as unknown as fs.Dirent[]);

    const result = checkGuideTasks(makeConfig(), "/workspace");
    const firstMsg = result.tasks.find((t) => t.task.id === "first-message");
    expect(firstMsg?.completed).toBe(true);
    expect(mockedFs.existsSync).toHaveBeenCalledWith("/mock-state/agents/main/sessions");
  });

  it("returns false when no session transcripts exist", () => {
    mockedFs.existsSync.mockReturnValue(false);

    const result = checkGuideTasks(makeConfig(), "/workspace");
    const firstMsg = result.tasks.find((t) => t.task.id === "first-message");
    expect(firstMsg?.completed).toBe(false);
  });
});

describe("checkGuideTasks - channel detection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detects googlechat as a configured channel", () => {
    const config = makeConfig({
      channels: {
        googlechat: { serviceAccountKeyFile: "/path/to/key.json" },
      },
    });
    const result = checkGuideTasks(config, "/workspace");
    const channel = result.tasks.find((t) => t.task.id === "channel");
    expect(channel?.completed).toBe(true);
  });

  it("detects msteams as a configured channel", () => {
    const config = makeConfig({
      channels: {
        msteams: { appId: "some-id", appPassword: "secret" },
      },
    });
    const result = checkGuideTasks(config, "/workspace");
    const channel = result.tasks.find((t) => t.task.id === "channel");
    expect(channel?.completed).toBe(true);
  });

  it("detects extension channels via [key: string]", () => {
    const config = makeConfig({
      channels: {
        "my-custom-channel": { token: "abc" },
      },
    });
    const result = checkGuideTasks(config, "/workspace");
    const channel = result.tasks.find((t) => t.task.id === "channel");
    expect(channel?.completed).toBe(true);
  });

  it("ignores defaults key", () => {
    const config = makeConfig({
      channels: {
        defaults: { groupPolicy: "allowAll" },
      },
    } as Partial<OpenClawConfig>);
    const result = checkGuideTasks(config, "/workspace");
    const channel = result.tasks.find((t) => t.task.id === "channel");
    expect(channel?.completed).toBe(false);
  });

  it("returns false when channels is empty", () => {
    const config = makeConfig({ channels: {} });
    const result = checkGuideTasks(config, "/workspace");
    const channel = result.tasks.find((t) => t.task.id === "channel");
    expect(channel?.completed).toBe(false);
  });
});
