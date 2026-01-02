import { describe, expect, it } from "vitest";

import {
  detectDeepResearchIntent,
  extractTopicFromMessage,
  getDefaultPatterns,
} from "./detect.js";

describe("detectDeepResearchIntent", () => {
  describe("Russian patterns", () => {
    it("detects \"сделай депресерч\"", () => {
      expect(detectDeepResearchIntent("Сделай депресерч про AI")).toBe(true);
    });

    it("detects \"депресерч\" standalone", () => {
      expect(detectDeepResearchIntent("Депресерч!")).toBe(true);
    });

    it("detects \"дип рисерч\" phonetic", () => {
      expect(
        detectDeepResearchIntent("Сделай дип рисерч про криптовалюты"),
      ).toBe(true);
    });
  });

  describe("English patterns", () => {
    it("detects \"deep research\"", () => {
      expect(
        detectDeepResearchIntent("Do deep research on quantum computing"),
      ).toBe(true);
    });

    it("detects \"deepresearch\" without space", () => {
      expect(detectDeepResearchIntent("deepresearch AI trends")).toBe(true);
    });
  });

  describe("Mixed patterns", () => {
    it("detects \"сделай deep research\"", () => {
      expect(
        detectDeepResearchIntent("Сделай deep research про блокчейн"),
      ).toBe(true);
    });
  });

  describe("Case insensitivity", () => {
    it("detects uppercase \"ДЕПРЕСЕРЧ\"", () => {
      expect(detectDeepResearchIntent("Сделай ДЕПРЕСЕРЧ")).toBe(true);
    });

    it("detects mixed case \"Deep Research\"", () => {
      expect(detectDeepResearchIntent("Do Deep Research please")).toBe(true);
    });
  });

  describe("Substring matching", () => {
    it("matches \"депресерчить\" (contains депресерч)", () => {
      expect(detectDeepResearchIntent("депресерчнуть бы")).toBe(true);
    });

    it("matches \"deep researching\"", () => {
      expect(detectDeepResearchIntent("I am deep researching this topic")).toBe(
        true,
      );
    });
  });

  describe("Non-matching cases", () => {
    it("does NOT match \"deepsearch\" (different word)", () => {
      expect(detectDeepResearchIntent("deepsearch something")).toBe(false);
    });

    it("does NOT match \"исследование\" (not in patterns)", () => {
      expect(detectDeepResearchIntent("Сделай исследование")).toBe(false);
    });

    it("does NOT match empty string", () => {
      expect(detectDeepResearchIntent("")).toBe(false);
    });

    it("does NOT match random text", () => {
      expect(detectDeepResearchIntent("Hello, how are you?")).toBe(false);
    });
  });

  describe("Custom patterns", () => {
    it("uses custom patterns when provided", () => {
      expect(detectDeepResearchIntent("custom trigger", ["custom trigger"])).toBe(
        true,
      );
      expect(detectDeepResearchIntent("депресерч", ["custom trigger"])).toBe(
        false,
      );
    });
  });
});

describe("extractTopicFromMessage", () => {
  it("extracts topic after \"сделай депресерч про\"", () => {
    expect(
      extractTopicFromMessage("Сделай депресерч про квантовые компьютеры"),
    ).toBe("квантовые компьютеры");
  });

  it("extracts topic after \"deep research on\"", () => {
    expect(extractTopicFromMessage("Do deep research on AI safety")).toBe(
      "Do on AI safety",
    );
  });

  it("returns original if no pattern found", () => {
    expect(extractTopicFromMessage("random message")).toBe("random message");
  });

  it("handles pattern at end of message", () => {
    expect(extractTopicFromMessage("Нужен депресерч")).toBe("Нужен");
  });

  it("cleans leading punctuation", () => {
    expect(extractTopicFromMessage("Депресерч: тема исследования")).toBe(
      "тема исследования",
    );
  });

  it("uses custom patterns when provided", () => {
    expect(
      extractTopicFromMessage("custom trigger about space", ["custom trigger"]),
    ).toBe("about space");
  });
});

describe("getDefaultPatterns", () => {
  it("returns 20 patterns", () => {
    expect(getDefaultPatterns()).toHaveLength(20);
  });

  it("includes key patterns", () => {
    const patterns = getDefaultPatterns();
    expect(patterns).toContain("депресерч");
    expect(patterns).toContain("deep research");
    expect(patterns).toContain("дип рисерч");
  });
});
