import { describe, expect, it } from "vitest";
import {
  normalizeSlackSlug,
  normalizeAllowList,
  normalizeAllowListLower,
  resolveSlackAllowListMatch,
  allowListMatches,
  resolveSlackUserAllowed,
} from "./allow-list.js";

describe("normalizeSlackSlug", () => {
  it("returns empty string for undefined/empty input", () => {
    expect(normalizeSlackSlug()).toBe("");
    expect(normalizeSlackSlug("")).toBe("");
    expect(normalizeSlackSlug("   ")).toBe("");
  });

  it("lowercases and trims input", () => {
    expect(normalizeSlackSlug("  General  ")).toBe("general");
    expect(normalizeSlackSlug("MY-CHANNEL")).toBe("my-channel");
  });

  it("replaces spaces with dashes", () => {
    expect(normalizeSlackSlug("my channel")).toBe("my-channel");
    expect(normalizeSlackSlug("a  b   c")).toBe("a-b-c");
  });

  it("removes invalid characters", () => {
    expect(normalizeSlackSlug("my!channel")).toBe("my-channel");
    expect(normalizeSlackSlug("test@channel#1")).toBe("test@channel#1");
  });

  it("collapses multiple dashes", () => {
    expect(normalizeSlackSlug("a--b---c")).toBe("a-b-c");
  });

  it("removes leading/trailing dashes and dots", () => {
    expect(normalizeSlackSlug("-channel-")).toBe("channel");
    expect(normalizeSlackSlug(".channel.")).toBe("channel");
    expect(normalizeSlackSlug(".-channel-.")).toBe("channel");
  });

  it("handles complex names", () => {
    expect(normalizeSlackSlug("My Channel Name")).toBe("my-channel-name");
    expect(normalizeSlackSlug("  Team: Engineering  ")).toBe("team-engineering");
  });
});

describe("normalizeAllowList", () => {
  it("returns empty array for undefined/empty input", () => {
    expect(normalizeAllowList()).toEqual([]);
    expect(normalizeAllowList([])).toEqual([]);
  });

  it("converts numbers to strings", () => {
    expect(normalizeAllowList([123, "abc"])).toEqual(["123", "abc"]);
  });

  it("trims whitespace", () => {
    expect(normalizeAllowList(["  foo  ", "bar"])).toEqual(["foo", "bar"]);
  });

  it("filters empty strings", () => {
    expect(normalizeAllowList(["", "foo", "  ", "bar"])).toEqual(["foo", "bar"]);
  });
});

describe("normalizeAllowListLower", () => {
  it("lowercases all entries", () => {
    expect(normalizeAllowListLower(["FOO", "Bar", "baz"])).toEqual(["foo", "bar", "baz"]);
  });

  it("combines with normalizeAllowList behavior", () => {
    expect(normalizeAllowListLower(["  FOO  ", "", "BAR"])).toEqual(["foo", "bar"]);
  });
});

describe("resolveSlackAllowListMatch", () => {
  describe("empty allowlist", () => {
    it("returns allowed: false", () => {
      const result = resolveSlackAllowListMatch({
        allowList: [],
        id: "C12345",
        name: "general",
      });
      expect(result).toEqual({ allowed: false });
    });
  });

  describe("wildcard matching", () => {
    it("returns allowed: true with wildcard source", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["*"],
        id: "C12345",
        name: "general",
      });
      expect(result).toEqual({
        allowed: true,
        matchKey: "*",
        matchSource: "wildcard",
      });
    });

    it("wildcard takes precedence even with other entries", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["c12345", "*", "general"],
        id: "C99999",
        name: "random",
      });
      expect(result.matchSource).toBe("wildcard");
    });
  });

  describe("exact ID matching", () => {
    it("matches exact ID (case-insensitive)", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["c12345"],
        id: "C12345",
        name: "general",
      });
      expect(result).toEqual({
        allowed: true,
        matchKey: "c12345",
        matchSource: "id",
      });
    });

    it("does not match when ID differs", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["c99999"],
        id: "C12345",
        name: "general",
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe("prefixed ID matching (slack:)", () => {
    it("matches slack: prefixed ID", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["slack:c12345"],
        id: "C12345",
        name: "general",
      });
      expect(result).toEqual({
        allowed: true,
        matchKey: "slack:c12345",
        matchSource: "prefixed-id",
      });
    });
  });

  describe("prefixed user matching (user:)", () => {
    it("matches user: prefixed ID", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["user:c12345"],
        id: "C12345",
        name: "general",
      });
      expect(result).toEqual({
        allowed: true,
        matchKey: "user:c12345",
        matchSource: "prefixed-user",
      });
    });
  });

  describe("exact name matching", () => {
    it("matches exact name (case-insensitive)", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["general"],
        id: "C12345",
        name: "General",
      });
      expect(result).toEqual({
        allowed: true,
        matchKey: "general",
        matchSource: "name",
      });
    });
  });

  describe("prefixed name matching (slack:#)", () => {
    it("matches slack: prefixed name", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["slack:#general"],
        id: "C12345",
        name: "#general",
      });
      expect(result).toEqual({
        allowed: true,
        matchKey: "slack:#general",
        matchSource: "prefixed-name",
      });
    });
  });

  describe("slug normalization matching", () => {
    it("matches normalized slug from name", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["my-channel"],
        id: "C12345",
        name: "My Channel",
      });
      expect(result).toEqual({
        allowed: true,
        matchKey: "my-channel",
        matchSource: "slug",
      });
    });

    it("handles complex slug normalization", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["team-engineering"],
        id: "C12345",
        name: "Team: Engineering",
      });
      expect(result).toEqual({
        allowed: true,
        matchKey: "team-engineering",
        matchSource: "slug",
      });
    });
  });

  describe("match priority", () => {
    it("prefers ID match over name match", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["c12345", "general"],
        id: "C12345",
        name: "general",
      });
      expect(result.matchSource).toBe("id");
    });

    it("prefers prefixed-id over name match", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["slack:c12345", "general"],
        id: "C12345",
        name: "general",
      });
      expect(result.matchSource).toBe("prefixed-id");
    });
  });

  describe("missing id/name", () => {
    it("handles missing ID", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["general"],
        name: "general",
      });
      expect(result.allowed).toBe(true);
      expect(result.matchSource).toBe("name");
    });

    it("handles missing name", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["c12345"],
        id: "C12345",
      });
      expect(result.allowed).toBe(true);
      expect(result.matchSource).toBe("id");
    });

    it("returns false when no ID or name provided", () => {
      const result = resolveSlackAllowListMatch({
        allowList: ["something"],
      });
      expect(result.allowed).toBe(false);
    });
  });
});

describe("allowListMatches", () => {
  it("returns true when match found", () => {
    expect(
      allowListMatches({
        allowList: ["general"],
        id: "C12345",
        name: "general",
      }),
    ).toBe(true);
  });

  it("returns false when no match", () => {
    expect(
      allowListMatches({
        allowList: ["random"],
        id: "C12345",
        name: "general",
      }),
    ).toBe(false);
  });

  it("returns false for empty allowlist", () => {
    expect(
      allowListMatches({
        allowList: [],
        id: "C12345",
        name: "general",
      }),
    ).toBe(false);
  });
});

describe("resolveSlackUserAllowed", () => {
  it("returns true when allowlist is empty/undefined", () => {
    expect(resolveSlackUserAllowed({})).toBe(true);
    expect(resolveSlackUserAllowed({ allowList: [] })).toBe(true);
    expect(resolveSlackUserAllowed({ allowList: undefined })).toBe(true);
  });

  it("normalizes and lowercases allowlist before matching", () => {
    expect(
      resolveSlackUserAllowed({
        allowList: ["  U12345  "],
        userId: "u12345",
      }),
    ).toBe(true);
  });

  it("matches by userId", () => {
    expect(
      resolveSlackUserAllowed({
        allowList: ["u12345"],
        userId: "U12345",
      }),
    ).toBe(true);
  });

  it("matches by userName", () => {
    expect(
      resolveSlackUserAllowed({
        allowList: ["alice"],
        userName: "Alice",
      }),
    ).toBe(true);
  });

  it("returns false when user not in list", () => {
    expect(
      resolveSlackUserAllowed({
        allowList: ["u99999"],
        userId: "U12345",
        userName: "alice",
      }),
    ).toBe(false);
  });

  it("handles numeric entries in allowlist", () => {
    expect(
      resolveSlackUserAllowed({
        allowList: [12345],
        userId: "12345",
      }),
    ).toBe(true);
  });
});
