import { describe, expect, it, vi } from "vitest";
import type { CambClientWrapper } from "../client.js";
import type { CambAiConfig } from "../config.js";
import { createSoundGenerateTool } from "./sound-generate.js";

// Mock the media module
vi.mock("../media.js", () => ({
  saveAudioFile: vi.fn().mockResolvedValue("/tmp/camb-ai/sound_mock.wav"),
}));

function createConfig(overrides: Partial<CambAiConfig> = {}): CambAiConfig {
  return {
    enabled: true,
    apiKey: "test-api-key",
    tts: {
      model: "mars-flash",
      defaultLanguage: "en-us",
      defaultVoiceId: 123,
      outputFormat: "mp3",
    },
    voiceCloning: { enabled: false },
    soundGeneration: { enabled: true },
    pollingIntervalMs: 100,
    pollingTimeoutMs: 1000,
    ...overrides,
  };
}

function createMockClientWrapper(taskId = "sound-task-123"): CambClientWrapper {
  const mockAudioResponse = {
    arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer),
  };

  const mockClient = {
    textToAudio: {
      createTextToAudio: vi.fn().mockResolvedValue({ task_id: taskId }),
      getTextToAudioStatus: vi.fn().mockResolvedValue({ status: "SUCCESS", run_id: 42 }),
      getTextToAudioResult: vi.fn().mockResolvedValue(mockAudioResponse),
    },
  };

  return {
    getClient: vi.fn().mockReturnValue(mockClient),
    pollForCompletion: vi.fn().mockImplementation(async (_check, getResult) => {
      return getResult(42);
    }),
  } as unknown as CambClientWrapper;
}

describe("camb_sound_generate tool", () => {
  it("has correct tool metadata", () => {
    const wrapper = createMockClientWrapper();
    const config = createConfig();
    const tool = createSoundGenerateTool(wrapper, config);

    expect(tool.name).toBe("camb_sound_generate");
    expect(tool.label).toBe("Camb AI Sound Generate");
    expect(tool.description).toContain("Generate music or sound effects");
  });

  describe("execute", () => {
    it("returns error when sound generation is disabled", async () => {
      const wrapper = createMockClientWrapper();
      const config = createConfig({ soundGeneration: { enabled: false } });
      const tool = createSoundGenerateTool(wrapper, config);

      const result = await tool.execute("call-1", {
        prompt: "upbeat music",
      });
      const details = (result as any).details;

      expect(details.error).toContain("Sound generation is disabled");
    });

    it("returns error when prompt is missing", async () => {
      const wrapper = createMockClientWrapper();
      const config = createConfig();
      const tool = createSoundGenerateTool(wrapper, config);

      const result = await tool.execute("call-1", {});
      const details = (result as any).details;

      expect(details.error).toBe("prompt is required");
    });

    it("returns error when prompt is empty", async () => {
      const wrapper = createMockClientWrapper();
      const config = createConfig();
      const tool = createSoundGenerateTool(wrapper, config);

      const result = await tool.execute("call-1", { prompt: "   " });
      const details = (result as any).details;

      expect(details.error).toBe("prompt is required");
    });

    it("generates sound successfully with defaults", async () => {
      const wrapper = createMockClientWrapper("task-abc");
      const config = createConfig();
      const tool = createSoundGenerateTool(wrapper, config);

      const result = await tool.execute("call-1", {
        prompt: "thunderstorm with rain",
      });
      const details = (result as any).details;

      expect(details.success).toBe(true);
      expect(details.task_id).toBe("task-abc");
      expect(details.prompt).toBe("thunderstorm with rain");
      expect(details.duration).toBe(10);
    });

    it("uses custom duration when provided", async () => {
      const wrapper = createMockClientWrapper();
      const config = createConfig();
      const tool = createSoundGenerateTool(wrapper, config);

      const result = await tool.execute("call-1", {
        prompt: "birds chirping",
        duration: 30,
      });
      const details = (result as any).details;

      expect(details.success).toBe(true);
      expect(details.duration).toBe(30);
    });

    it("calls API with correct parameters", async () => {
      const createTextToAudioMock = vi.fn().mockResolvedValue({ task_id: "sound-task-123" });
      const mockAudioResponse = {
        arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2]).buffer),
      };
      const wrapper = {
        getClient: vi.fn().mockReturnValue({
          textToAudio: {
            createTextToAudio: createTextToAudioMock,
            getTextToAudioStatus: vi.fn().mockResolvedValue({ status: "SUCCESS", run_id: 42 }),
            getTextToAudioResult: vi.fn().mockResolvedValue(mockAudioResponse),
          },
        }),
        pollForCompletion: vi.fn().mockImplementation(async (_check, getResult) => getResult(42)),
      } as unknown as CambClientWrapper;
      const config = createConfig();
      const tool = createSoundGenerateTool(wrapper, config);

      await tool.execute("call-1", {
        prompt: "ocean waves",
        duration: 15,
      });

      expect(createTextToAudioMock).toHaveBeenCalledWith({
        prompt: "ocean waves",
        duration: 15,
      });
    });

    it("clamps duration to valid range", async () => {
      const wrapper = createMockClientWrapper();
      const config = createConfig();
      const tool = createSoundGenerateTool(wrapper, config);

      const result = await tool.execute("call-1", {
        prompt: "test",
        duration: 100,
      });
      const details = (result as any).details;

      expect(details.success).toBe(true);
      expect(details.duration).toBe(30);
    });

    it("handles task creation failure", async () => {
      const wrapper = {
        getClient: vi.fn().mockReturnValue({
          textToAudio: {
            createTextToAudio: vi.fn().mockResolvedValue({}),
          },
        }),
        pollForCompletion: vi.fn(),
      } as unknown as CambClientWrapper;
      const config = createConfig();
      const tool = createSoundGenerateTool(wrapper, config);

      const result = await tool.execute("call-1", {
        prompt: "test sound",
      });
      const details = (result as any).details;

      expect(details.error).toBe("Failed to create sound generation task");
    });

    it("handles API errors gracefully", async () => {
      const wrapper = {
        getClient: vi.fn().mockReturnValue({
          textToAudio: {
            createTextToAudio: vi.fn().mockRejectedValue(new Error("Rate limit exceeded")),
          },
        }),
        pollForCompletion: vi.fn(),
      } as unknown as CambClientWrapper;
      const config = createConfig();
      const tool = createSoundGenerateTool(wrapper, config);

      const result = await tool.execute("call-1", {
        prompt: "test",
      });
      const details = (result as any).details;

      expect(details.error).toBe("Rate limit exceeded");
    });

    it("returns file path and audio info on success", async () => {
      const wrapper = createMockClientWrapper("task-xyz");
      const config = createConfig();
      const tool = createSoundGenerateTool(wrapper, config);

      const result = await tool.execute("call-1", {
        prompt: "calm music",
      });
      const details = (result as any).details;

      expect(details.success).toBe(true);
      expect(details.file_path).toBeDefined();
      expect(details.audio_size_bytes).toBeGreaterThan(0);
      expect(details.play_command).toBeDefined();
    });
  });
});
