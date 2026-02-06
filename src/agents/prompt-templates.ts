/**
 * Template loading infrastructure for signed system prompts.
 *
 * Loads prompt templates from `llm/prompts/` and supports `{{placeholder}}`
 * interpolation. Templates are cached in memory after first load.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, "../../llm/prompts");

const templateCache = new Map<string, string>();

/**
 * Load a template file synchronously from `llm/prompts/`.
 * Results are cached in memory.
 */
export function loadTemplate(name: string): string {
  const cached = templateCache.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const filePath = resolve(TEMPLATES_DIR, name);
  const content = readFileSync(filePath, "utf8");
  templateCache.set(name, content);
  return content;
}

/**
 * Interpolate `{{placeholder}}` tokens in a template string.
 * Unmatched placeholders are left as-is.
 */
export function interpolate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in data ? data[key] : match;
  });
}

/**
 * Load a template and interpolate placeholders in one step.
 */
export function loadAndInterpolate(name: string, data: Record<string, string>): string {
  return interpolate(loadTemplate(name), data);
}

/**
 * Clear the template cache (useful for testing).
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}

/**
 * Get the resolved templates directory path.
 */
export function getTemplatesDir(): string {
  return TEMPLATES_DIR;
}
