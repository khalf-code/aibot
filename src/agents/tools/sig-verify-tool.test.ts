import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageSigningContext } from "../message-signing.js";

const { checkFileMock, findProjectRootMock, verifyFileMock, readdirMock, setVerifiedMock } =
  vi.hoisted(() => ({
    checkFileMock: vi.fn(),
    findProjectRootMock: vi.fn(),
    verifyFileMock: vi.fn(),
    readdirMock: vi.fn(),
    setVerifiedMock: vi.fn(),
  }));

vi.mock("@disreguard/sig", () => ({
  checkFile: checkFileMock,
  findProjectRoot: findProjectRootMock,
  verifyFile: verifyFileMock,
}));

vi.mock("node:fs/promises", () => ({
  readdir: readdirMock,
}));

vi.mock("../session-security-state.js", () => ({
  setVerified: setVerifiedMock,
}));

import { createSigVerifyTool } from "./sig-verify-tool.js";

describe("createSigVerifyTool", () => {
  beforeEach(() => {
    checkFileMock.mockReset();
    findProjectRootMock.mockReset();
    verifyFileMock.mockReset();
    readdirMock.mockReset();
    setVerifiedMock.mockReset();
  });

  it("sets turn verification when message verification succeeds", async () => {
    const store = {
      verify: vi.fn().mockReturnValue({
        verified: true,
        content: "trusted message",
        signature: {
          signedBy: "owner:+15555550123:signal",
          signedAt: "2026-02-07T00:00:00.000Z",
          metadata: {},
        },
      }),
    };
    const tool = createSigVerifyTool({
      messageSigning: { store, sessionId: "main" } as unknown as MessageSigningContext,
      sessionKey: "main",
      turnId: "turn-1",
    });

    const result = await tool.execute("call-1", { message: "sig-id" }, undefined, undefined);
    expect(setVerifiedMock).toHaveBeenCalledWith("main", "turn-1");
    expect(result.details).toMatchObject({
      verified: true,
      messageId: "sig-id",
      content: "trusted message",
    });
  });

  it("uses injected projectRoot without calling findProjectRoot", async () => {
    readdirMock.mockResolvedValue([{ isFile: () => true, name: "identity.txt" }]);
    checkFileMock.mockResolvedValue({ status: "signed" });
    verifyFileMock.mockResolvedValue({
      file: "llm/prompts/identity.txt",
      verified: true,
      template: "You are a personal assistant running inside OpenClaw.",
      signedBy: "openclaw",
      signedAt: "2026-02-07T00:00:00.000Z",
      placeholders: [],
    });
    findProjectRootMock.mockResolvedValue("/should/not/use");

    const tool = createSigVerifyTool({
      projectRoot: "/workspace",
      sessionKey: "main",
      turnId: "turn-1",
    });

    const result = await tool.execute("call-2", {}, undefined, undefined);
    expect(findProjectRootMock).not.toHaveBeenCalled();
    expect(checkFileMock).toHaveBeenCalledWith("/workspace", "llm/prompts/identity.txt");
    expect(result.details).toMatchObject({ allVerified: true });
  });

  it("does not set turn verification for single-template checks", async () => {
    verifyFileMock.mockResolvedValue({
      file: "llm/prompts/identity.txt",
      verified: true,
      template: "You are a personal assistant running inside OpenClaw.",
      signedBy: "openclaw",
      signedAt: "2026-02-07T00:00:00.000Z",
      placeholders: [],
    });

    const tool = createSigVerifyTool({
      projectRoot: "/workspace",
      sessionKey: "main",
      turnId: "turn-1",
    });

    const result = await tool.execute(
      "call-single",
      { file: "identity.txt" },
      undefined,
      undefined,
    );
    expect(result.details).toMatchObject({ allVerified: true });
    expect(setVerifiedMock).not.toHaveBeenCalled();
  });

  it("fails verification when any template in llm/prompts is unsigned", async () => {
    readdirMock.mockResolvedValue([
      { isFile: () => true, name: "identity.txt" },
      { isFile: () => true, name: "message-provenance.txt" },
    ]);
    checkFileMock.mockImplementation(async (_projectRoot: string, path: string) => {
      if (path.endsWith("identity.txt")) {
        return { status: "signed" };
      }
      return { status: "unsigned" };
    });
    verifyFileMock.mockResolvedValue({
      file: "llm/prompts/identity.txt",
      verified: true,
      template: "You are a personal assistant running inside OpenClaw.",
      signedBy: "openclaw",
      signedAt: "2026-02-07T00:00:00.000Z",
      placeholders: [],
    });

    const tool = createSigVerifyTool({
      projectRoot: "/workspace",
      sessionKey: "main",
      turnId: "turn-1",
    });

    const result = await tool.execute("call-3", {}, undefined, undefined);
    expect(result.details).toMatchObject({ allVerified: false });
    expect(result.details).toMatchObject({
      templates: expect.arrayContaining([
        expect.objectContaining({
          file: "llm/prompts/message-provenance.txt",
          verified: false,
          error: "No signature found",
        }),
      ]),
    });
    expect(setVerifiedMock).not.toHaveBeenCalled();
  });
});
