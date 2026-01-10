import { describe, expect, it } from "vitest";
import {
  COMPLEXITY_TOKEN_LIMITS,
  estimateQueryComplexity,
  getRecommendedMaxTokens,
  shouldUsePowerfulModel,
} from "./query-complexity.js";

describe("estimateQueryComplexity", () => {
  describe("simple queries", () => {
    it("classifies short greetings as simple", () => {
      expect(estimateQueryComplexity("Hello")).toBe("simple");
      expect(estimateQueryComplexity("Hi there")).toBe("simple");
      expect(estimateQueryComplexity("Thanks")).toBe("simple");
    });

    it("classifies yes/no questions as simple", () => {
      expect(estimateQueryComplexity("Yes")).toBe("simple");
      expect(estimateQueryComplexity("No")).toBe("simple");
      expect(estimateQueryComplexity("Ok")).toBe("simple");
    });

    it("classifies very short messages as simple", () => {
      expect(estimateQueryComplexity("Got it")).toBe("simple");
      expect(estimateQueryComplexity("Perfect")).toBe("simple");
    });
  });

  describe("medium queries", () => {
    it("classifies explanation requests as medium", () => {
      expect(estimateQueryComplexity("What does this do?")).toBe("medium");
      expect(estimateQueryComplexity("Explain how authentication works")).toBe(
        "medium",
      );
      expect(estimateQueryComplexity("Describe the architecture")).toBe(
        "medium",
      );
    });

    it("classifies search/find requests as medium", () => {
      expect(estimateQueryComplexity("Find all instances of foo")).toBe(
        "medium",
      );
      expect(estimateQueryComplexity("Show me the test files")).toBe("medium");
      expect(estimateQueryComplexity("List all components")).toBe("medium");
    });

    it("classifies code entity questions as medium", () => {
      expect(estimateQueryComplexity("What is this function?")).toBe("medium");
      expect(estimateQueryComplexity("Where is the class defined?")).toBe(
        "medium",
      );
    });

    it("classifies short code references as medium", () => {
      expect(estimateQueryComplexity("Read src/index.ts")).toBe("medium");
      expect(estimateQueryComplexity("Check the file")).toBe("medium");
    });
  });

  describe("complex queries", () => {
    it("classifies implementation requests as complex", () => {
      expect(estimateQueryComplexity("Implement user authentication")).toBe(
        "complex",
      );
      expect(estimateQueryComplexity("Create a new API endpoint")).toBe(
        "complex",
      );
      expect(estimateQueryComplexity("Build a dashboard component")).toBe(
        "complex",
      );
    });

    it("classifies fix/debug requests as complex", () => {
      expect(estimateQueryComplexity("Fix the bug in the login flow")).toBe(
        "complex",
      );
      expect(estimateQueryComplexity("Debug the failing test")).toBe("complex");
    });

    it("classifies refactoring requests as complex", () => {
      expect(
        estimateQueryComplexity("Refactor the authentication module"),
      ).toBe("complex");
      expect(estimateQueryComplexity("Optimize the database queries")).toBe(
        "complex",
      );
    });

    it("classifies code modification requests as complex", () => {
      expect(estimateQueryComplexity("Update the error handling")).toBe(
        "complex",
      );
      expect(estimateQueryComplexity("Add validation to the form")).toBe(
        "complex",
      );
      expect(estimateQueryComplexity("Remove the deprecated API")).toBe(
        "complex",
      );
    });

    it("classifies long messages as complex", () => {
      const longMessage = `I need help with the application. ${"x".repeat(200)}`;
      expect(estimateQueryComplexity(longMessage)).toBe("complex");
    });

    it("classifies code entity references without action keywords as medium", () => {
      // Without explicit action keywords, code references are medium complexity
      expect(
        estimateQueryComplexity(
          "The function at src/utils/helper.ts needs work",
        ),
      ).toBe("medium");
    });

    it("classifies long code references as complex", () => {
      // Longer messages with code references are complex
      expect(
        estimateQueryComplexity(
          "The function at src/utils/helper.ts needs work because it has performance issues that cause slowdowns",
        ),
      ).toBe("complex");
    });
  });
});

describe("getRecommendedMaxTokens", () => {
  it("returns 512 for simple queries", () => {
    expect(getRecommendedMaxTokens("Hello")).toBe(512);
  });

  it("returns 2048 for medium queries", () => {
    expect(getRecommendedMaxTokens("What does this function do?")).toBe(2048);
  });

  it("returns 8192 for complex queries", () => {
    expect(getRecommendedMaxTokens("Implement user authentication")).toBe(8192);
  });
});

describe("shouldUsePowerfulModel", () => {
  it("returns false for simple queries", () => {
    expect(shouldUsePowerfulModel("Hello")).toBe(false);
  });

  it("returns false for medium queries", () => {
    expect(shouldUsePowerfulModel("What does this function do?")).toBe(false);
  });

  it("returns true for complex queries", () => {
    expect(shouldUsePowerfulModel("Implement user authentication")).toBe(true);
    expect(shouldUsePowerfulModel("Fix the bug in the login flow")).toBe(true);
  });
});

describe("COMPLEXITY_TOKEN_LIMITS", () => {
  it("has expected values", () => {
    expect(COMPLEXITY_TOKEN_LIMITS.simple).toBe(512);
    expect(COMPLEXITY_TOKEN_LIMITS.medium).toBe(2048);
    expect(COMPLEXITY_TOKEN_LIMITS.complex).toBe(8192);
  });
});
