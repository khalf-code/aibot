import { describe, expect, it } from "vitest";

import { expandTextLinks } from "./helpers.js";

describe("expandTextLinks", () => {
  it("returns text unchanged when no entities provided", () => {
    expect(expandTextLinks("Hello world")).toBe("Hello world");
    expect(expandTextLinks("Hello world", null)).toBe("Hello world");
    expect(expandTextLinks("Hello world", [])).toBe("Hello world");
  });

  it("returns text unchanged when no text_link entities", () => {
    const entities = [
      { type: "mention", offset: 0, length: 5 },
      { type: "bold", offset: 6, length: 5 },
    ];
    expect(expandTextLinks("@user hello", entities)).toBe("@user hello");
  });

  it("expands single text_link entity", () => {
    const text = "Check this link for details";
    const entities = [{ type: "text_link", offset: 11, length: 4, url: "https://example.com" }];
    expect(expandTextLinks(text, entities)).toBe(
      "Check this [link](https://example.com) for details",
    );
  });

  it("expands multiple text_link entities", () => {
    const text = "Visit Google or GitHub for more";
    const entities = [
      { type: "text_link", offset: 6, length: 6, url: "https://google.com" },
      { type: "text_link", offset: 16, length: 6, url: "https://github.com" },
    ];
    expect(expandTextLinks(text, entities)).toBe(
      "Visit [Google](https://google.com) or [GitHub](https://github.com) for more",
    );
  });

  it("handles text_link at start of text", () => {
    const text = "Click here to learn more";
    const entities = [{ type: "text_link", offset: 0, length: 10, url: "https://example.com" }];
    expect(expandTextLinks(text, entities)).toBe("[Click here](https://example.com) to learn more");
  });

  it("handles text_link at end of text", () => {
    const text = "Learn more at this site";
    const entities = [{ type: "text_link", offset: 14, length: 9, url: "https://example.com" }];
    expect(expandTextLinks(text, entities)).toBe("Learn more at [this site](https://example.com)");
  });

  it("ignores text_link entities without url", () => {
    const text = "Check this link";
    const entities = [
      { type: "text_link", offset: 11, length: 4 }, // no url
      { type: "text_link", offset: 11, length: 4, url: "" }, // empty url
    ];
    expect(expandTextLinks(text, entities)).toBe("Check this link");
  });

  it("handles mixed entity types", () => {
    const text = "Hello @user check this link";
    const entities = [
      { type: "mention", offset: 6, length: 5 },
      { type: "text_link", offset: 23, length: 4, url: "https://example.com" },
    ];
    expect(expandTextLinks(text, entities)).toBe(
      "Hello @user check this [link](https://example.com)",
    );
  });

  it("handles unicode text correctly", () => {
    const text = "Тереза Торрес рассказала про это";
    const entities = [{ type: "text_link", offset: 0, length: 13, url: "https://example.com/teresa" }];
    expect(expandTextLinks(text, entities)).toBe(
      "[Тереза Торрес](https://example.com/teresa) рассказала про это",
    );
  });

  it("handles adjacent text_link entities", () => {
    const text = "AB";
    const entities = [
      { type: "text_link", offset: 0, length: 1, url: "https://a.com" },
      { type: "text_link", offset: 1, length: 1, url: "https://b.com" },
    ];
    expect(expandTextLinks(text, entities)).toBe("[A](https://a.com)[B](https://b.com)");
  });

  it("returns empty string unchanged", () => {
    expect(expandTextLinks("")).toBe("");
    expect(expandTextLinks("", [{ type: "text_link", offset: 0, length: 1, url: "https://x.com" }])).toBe("");
  });
});
