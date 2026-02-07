import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearTemplateCache,
  getTemplatesDir,
  interpolate,
  loadAndInterpolate,
  loadTemplate,
} from "./prompt-templates.js";

describe("prompt-templates", () => {
  beforeEach(() => {
    clearTemplateCache();
  });

  it("loadTemplate returns template content", () => {
    const content = loadTemplate("identity.txt");
    expect(content).toContain("You are a personal assistant running inside OpenClaw.");
  });

  it("interpolate replaces placeholders and keeps unmatched placeholders", () => {
    const value = interpolate("Hello {{name}} from {{city}} and {{missing}}", {
      name: "Ada",
      city: "NYC",
    });
    expect(value).toBe("Hello Ada from NYC and {{missing}}");
  });

  it("loadAndInterpolate loads and interpolates in one call", () => {
    const value = loadAndInterpolate("workspace.txt", { workspace_dir: "/tmp/workspace" });
    expect(value).toContain("Your working directory is: /tmp/workspace");
  });

  it("clearTemplateCache clears cached templates", () => {
    const templateName = `__cache-test-${Date.now()}.txt`;
    const templatePath = join(getTemplatesDir(), templateName);

    return (async () => {
      try {
        await writeFile(templatePath, "first value", "utf8");
        const first = loadTemplate(templateName);
        expect(first).toBe("first value");

        await writeFile(templatePath, "second value", "utf8");
        const stillCached = loadTemplate(templateName);
        expect(stillCached).toBe("first value");

        clearTemplateCache();
        const reloaded = loadTemplate(templateName);
        expect(reloaded).toBe("second value");
      } finally {
        await rm(templatePath, { force: true });
      }
    })();
  });

  it("throws for missing template files", () => {
    expect(() => loadTemplate("__missing_template__.txt")).toThrow();
  });
});
