import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ClawdbotConfig } from "../config/config.js";
import { logVerbose, shouldLogVerbose } from "../globals.js";
import { runExec } from "../process/exec.js";
import type { RuntimeEnv } from "../runtime.js";
import { applyTemplate, type MsgContext } from "./templating.js";

export function isAudio(mediaType?: string | null) {
  return Boolean(mediaType?.startsWith("audio"));
}

export async function transcribeInboundAudio(
  cfg: ClawdbotConfig,
  ctx: MsgContext,
  runtime: RuntimeEnv,
): Promise<{ text: string } | undefined> {
  const transcriber = cfg.routing?.transcribeAudio;
  if (!transcriber?.command?.length) return undefined;

  const timeoutMs = Math.max((transcriber.timeoutSeconds ?? 45) * 1000, 1_000);
  let tmpPath: string | undefined;
  let tmpDir: string | undefined;
  let mediaPath = ctx.MediaPath;
  try {
    if (!mediaPath && ctx.MediaUrl) {
      const res = await fetch(ctx.MediaUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      tmpDir = os.tmpdir();
      tmpPath = path.join(
        tmpDir,
        `clawdbot-audio-${crypto.randomUUID()}.ogg`,
      );
      await fs.writeFile(tmpPath, buffer);
      mediaPath = tmpPath;
      if (shouldLogVerbose()) {
        logVerbose(
          `Downloaded audio for transcription (${(buffer.length / (1024 * 1024)).toFixed(2)}MB) -> ${tmpPath}`,
        );
      }
    } else if (mediaPath) {
      // Use the directory of the existing media path as temp dir
      tmpDir = path.dirname(mediaPath);
    }
    if (!mediaPath) return undefined;

    const templCtx: MsgContext = { ...ctx, MediaPath: mediaPath };
    const argv = transcriber.command.map((part) =>
      applyTemplate(part, templCtx),
    );
    if (shouldLogVerbose()) {
      logVerbose(`Transcribing audio via command: ${argv.join(" ")}`);
    }
    
    // Run transcription in temp directory to prevent files being written to repo root
    const { stdout } = await runExec(argv[0], argv.slice(1), {
      timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
      cwd: tmpDir,
    });
    const text = stdout.trim();
    if (!text) return undefined;
    
    // Clean up any .txt files that mlx_whisper might have created in the temp directory
    if (tmpDir && tmpPath) {
      try {
        const baseName = path.basename(tmpPath, path.extname(tmpPath));
        // mlx_whisper may create files with the same base name + .txt extension
        const possibleTxtFile = path.join(tmpDir, `${baseName}.txt`);
        await fs.unlink(possibleTxtFile).catch(() => {
          // Ignore errors - file might not exist
        });
        // Also check for UUID-named .txt files (mlx_whisper might strip prefixes)
        // Extract UUID from filename (format: clawdis-audio-UUID.ogg -> UUID.txt)
        const uuidMatch = baseName.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (uuidMatch) {
          const uuidTxtFile = path.join(tmpDir, `${uuidMatch[0]}.txt`);
          await fs.unlink(uuidTxtFile).catch(() => {
            // Ignore errors
          });
        }
        // Also check for any .txt files matching the clawdbot-audio pattern
        const files = await fs.readdir(tmpDir).catch(() => []);
        for (const file of files) {
          if (file.endsWith('.txt') && (file.startsWith('clawdbot-audio-') || file.match(/^[0-9a-f-]{36}\.txt$/i))) {
            const txtPath = path.join(tmpDir, file);
            await fs.unlink(txtPath).catch(() => {
              // Ignore errors
            });
          }
        }
      } catch {
        // Ignore cleanup errors
      }
    }
    
    return { text };
  } catch (err) {
    runtime.error?.(`Audio transcription failed: ${String(err)}`);
    return undefined;
  } finally {
    if (tmpPath) {
      void fs.unlink(tmpPath).catch(() => {});
    }
  }
}
