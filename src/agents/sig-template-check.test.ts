import { initProject, signFile } from "@disreguard/sig";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkTemplateDrift } from "./sig-template-check.js";

async function setupProject() {
  const root = await mkdtemp(join(os.tmpdir(), "openclaw-sig-template-check-"));
  await mkdir(join(root, "llm/prompts"), { recursive: true });
  await initProject(root, { identity: "test:signer" });
  return root;
}

describe("checkTemplateDrift", () => {
  it("reports signed, unsigned, and modified templates", async () => {
    const root = await setupProject();
    const templatesDir = join(root, "llm/prompts");

    await writeFile(join(templatesDir, "signed.txt"), "signed-template\n", "utf8");
    await writeFile(join(templatesDir, "unsigned.txt"), "unsigned-template\n", "utf8");
    await writeFile(join(templatesDir, "modified.txt"), "before\n", "utf8");

    await signFile(root, "llm/prompts/signed.txt", { identity: "test:signer" });
    await signFile(root, "llm/prompts/modified.txt", { identity: "test:signer" });
    await writeFile(join(templatesDir, "modified.txt"), "after\n", "utf8");

    const drift = await checkTemplateDrift(root, templatesDir);

    expect(drift.ok).toEqual(["llm/prompts/signed.txt"]);
    expect(drift.unsigned).toEqual(["llm/prompts/unsigned.txt"]);
    expect(drift.modified).toEqual(["llm/prompts/modified.txt"]);
  });

  it("returns empty arrays when no templates are present", async () => {
    const root = await setupProject();
    const templatesDir = join(root, "llm/prompts");

    const drift = await checkTemplateDrift(root, templatesDir);
    expect(drift).toEqual({
      unsigned: [],
      modified: [],
      ok: [],
    });
  });

  it("returns empty arrays when templates directory does not exist", async () => {
    const root = await setupProject();
    const missingTemplatesDir = join(root, "missing/prompts");

    const drift = await checkTemplateDrift(root, missingTemplatesDir);
    expect(drift).toEqual({
      unsigned: [],
      modified: [],
      ok: [],
    });
  });
});
