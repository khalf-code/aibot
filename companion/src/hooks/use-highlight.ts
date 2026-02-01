import { useState, useEffect } from "react";
import { codeToHtml } from "shiki/bundle/web";

export const extToLang: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  py: "python", rb: "ruby", rs: "rust", go: "go",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  css: "css", scss: "scss", less: "less",
  sh: "bash", bash: "bash", zsh: "bash",
  md: "markdown", mdx: "markdown",
  sql: "sql", graphql: "graphql",
  swift: "swift", kt: "kotlin", java: "java",
  c: "c", cpp: "cpp", h: "c", hpp: "cpp",
};

export function getFileExtension(path: string): string {
  return (path.split(".").pop() ?? "").toLowerCase();
}

export function isHtml(path: string): boolean {
  return ["html", "htm", "svg"].includes(getFileExtension(path));
}

export function isImage(ext: string): boolean {
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico"].includes(ext);
}

const BINARY_EXTS = new Set([
  "xlsx", "xls", "pptx", "ppt", "docx", "doc",
  "pdf", "zip", "tar", "gz", "bz2", "7z", "rar",
  "exe", "dll", "so", "dylib", "bin", "dmg", "iso",
  "mp3", "mp4", "wav", "avi", "mov", "mkv", "flac",
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "tiff",
  "woff", "woff2", "ttf", "otf", "eot",
]);

export function isBinary(ext: string): boolean {
  return BINARY_EXTS.has(ext);
}

export function isSpreadsheet(ext: string): boolean {
  return ext === "xlsx" || ext === "xls";
}

export function isWordDoc(ext: string): boolean {
  return ext === "docx" || ext === "doc";
}

export function isPdf(ext: string): boolean {
  return ext === "pdf";
}

export function isPptx(ext: string): boolean {
  return ext === "pptx" || ext === "ppt";
}

export function isOfficeDoc(ext: string): boolean {
  return isSpreadsheet(ext) || isWordDoc(ext);
}

export function useHighlightedHtml(content: string | null, ext: string): string | null {
  const [html, setHtml] = useState<string | null>(null);
  const lang = extToLang[ext] ?? ext;

  useEffect(() => {
    if (!content) { setHtml(null); return; }
    let cancelled = false;
    codeToHtml(content, { lang, theme: "github-light" })
      .then((result) => { if (!cancelled) { setHtml(result); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [content, lang]);

  return html;
}
