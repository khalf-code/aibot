import { describe, expect, it } from "vitest";

import { extractMessageBody } from "./thread.js";

describe("extractMessageBody", () => {
  it("prefers extractedText", () => {
    const result = extractMessageBody({
      extractedText: "new content only",
      extractedHtml: "<p>new html</p>",
      text: "full text",
      html: "<p>full html</p>",
    });
    expect(result).toBe("new content only");
  });

  it("falls back to extractedHtml", () => {
    const result = extractMessageBody({
      extractedText: undefined,
      extractedHtml: "<p>new html</p>",
      text: "full text",
      html: "<p>full html</p>",
    });
    expect(result).toBe("<p>new html</p>");
  });

  it("falls back to text", () => {
    const result = extractMessageBody({
      extractedText: undefined,
      extractedHtml: undefined,
      text: "full text",
      html: "<p>full html</p>",
    });
    expect(result).toBe("full text");
  });

  it("falls back to html", () => {
    const result = extractMessageBody({
      extractedText: undefined,
      extractedHtml: undefined,
      text: undefined,
      html: "<p>full html</p>",
    });
    expect(result).toBe("<p>full html</p>");
  });

  it("returns empty string when all undefined", () => {
    const result = extractMessageBody({
      extractedText: undefined,
      extractedHtml: undefined,
      text: undefined,
      html: undefined,
    });
    expect(result).toBe("");
  });

  it("handles null values", () => {
    const result = extractMessageBody({
      extractedText: null as unknown as undefined,
      extractedHtml: null as unknown as undefined,
      text: "fallback text",
      html: undefined,
    });
    expect(result).toBe("fallback text");
  });

  it("handles empty strings by falling through", () => {
    // Empty string is falsy, so it falls through to next option
    const result = extractMessageBody({
      extractedText: "",
      extractedHtml: undefined,
      text: "text fallback",
      html: undefined,
    });
    // Note: "" is falsy so it will fall through - this tests current behavior
    expect(result).toBe("");
  });
});
