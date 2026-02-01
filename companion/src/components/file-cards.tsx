import { useMemo, useState, useEffect, useRef } from "react";
import { FileIcon } from "lucide-react";
import type { MessagePart, ToolCallPart, ToolResultPart } from "@/hooks/use-gateway";
import { getFileExtension, isBinary } from "@/hooks/use-highlight";
import { FileContentPreview } from "./file-viewer";

type FileInfo = {
  path: string;
  toolName: string;
};

type Props = {
  parts: MessagePart[];
  resultMap: Map<string, ToolResultPart>;
  onFileClick: (path: string) => void;
  readFile: (path: string) => Promise<string>;
  readFileBinary: (path: string) => Promise<ArrayBuffer>;
};

const PATH_ARG_KEYS = ["file_path", "path", "filePath", "filename", "file", "destination"];
const FILE_EXT_RE = /\.[a-zA-Z0-9]{1,10}$/;

function extractFilePathsFromToolCall(toolCall: ToolCallPart): FileInfo[] {
  const args = typeof toolCall.args === "object" && toolCall.args !== null
    ? toolCall.args as Record<string, unknown>
    : null;
  if (!args) {
    return [];
  }
  const name = toolCall.name ?? "";

  for (const key of PATH_ARG_KEYS) {
    const val = args[key];
    if (typeof val === "string" && val.includes("/") && FILE_EXT_RE.test(val)) {
      return [{ path: val, toolName: name }];
    }
  }

  for (const val of Object.values(args)) {
    if (typeof val !== "string") {
      continue;
    }
    const paths: FileInfo[] = [];
    const re = /(?:^|\s)(\/[\w./_~-]+\/[\w._-]+\.[a-zA-Z0-9]{1,10})/g;
    let match;
    while ((match = re.exec(val)) !== null) {
      paths.push({ path: match[1], toolName: name });
    }
    if (paths.length > 0) {
      return paths;
    }
  }

  return [];
}

const WORKSPACE_PATH = "~/.openclaw/workspace";

function extractFilePathsFromText(text: string): FileInfo[] {
  const paths: FileInfo[] = [];
  const seen = new Set<string>();

  const absRe = /(?:^|[\s`"'(])([~/][\w./_~-]*\/[\w._-]+\.[a-zA-Z0-9]{1,10})(?=[\s`"'),:.]|$)/gm;
  let match;
  while ((match = absRe.exec(text)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      paths.push({ path: match[1], toolName: "text" });
    }
  }

  const simpleRe = /(?:^|[\s`"'(])([\w_-]+\.[a-zA-Z0-9]{1,10})(?=[\s`"'),:.]|$)/gm;
  while ((match = simpleRe.exec(text)) !== null) {
    const filename = match[1];
    if (!filename.startsWith(".") && !/^\d+\.\d+/.test(filename)) {
      const fullPath = `${WORKSPACE_PATH}/${filename}`;
      if (!seen.has(fullPath)) {
        seen.add(fullPath);
        paths.push({ path: fullPath, toolName: "text" });
      }
    }
  }

  return paths;
}

function FilePreviewCard({ file, onFileClick, readFile, readFileBinary }: { file: FileInfo; onFileClick: (path: string) => void; readFile: (path: string) => Promise<string>; readFileBinary: (path: string) => Promise<ArrayBuffer> }) {
  const [content, setContent] = useState<string | null>(null);
  const [exists, setExists] = useState<boolean | null>(null);
  const fetched = useRef(false);
  const ext = getFileExtension(file.path);
  const binary = isBinary(ext);

  useEffect(() => {
    if (fetched.current) {
      return;
    }
    fetched.current = true;
    if (binary) {
      readFileBinary(file.path)
        .then(() => setExists(true))
        .catch(() => setExists(false));
    } else {
      readFile(file.path)
        .then((c) => { setContent(c); setExists(true); })
        .catch(() => setExists(false));
    }
  }, [file.path, readFile, readFileBinary, binary]);

  if (exists === null) {
    return null;
  }
  if (exists === false) {
    return null;
  }

  const fileName = file.path.split("/").pop() ?? file.path;

  return (
    <button
      type="button"
      className="group flex shrink-0 w-48 flex-col overflow-hidden rounded-lg border border-border/60 bg-muted/40 transition-colors hover:bg-muted/80 hover:border-border"
      onClick={() => onFileClick(file.path)}
    >
      <div className="h-28 w-full overflow-hidden bg-white">
        <FileContentPreview path={file.path} content={content ?? ""} readFileBinary={readFileBinary} compact />
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <FileIcon className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate text-[11px] font-medium">{fileName}</span>
      </div>
    </button>
  );
}

export function FileCards({ parts, resultMap, onFileClick, readFile, readFileBinary }: Props) {
  const files = useMemo(() => {
    const seen = new Set<string>();
    const result: FileInfo[] = [];
    for (const part of parts) {
      if (part.type === "toolCall") {
        const tc = part as ToolCallPart;
        for (const info of extractFilePathsFromToolCall(tc)) {
          if (!seen.has(info.path)) {
            seen.add(info.path);
            result.push(info);
          }
        }
      } else if (part.type === "text" && part.text) {
        for (const info of extractFilePathsFromText(part.text)) {
          if (!seen.has(info.path)) {
            seen.add(info.path);
            result.push(info);
          }
        }
      }
    }
    return result;
  }, [parts, resultMap]);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
      {files.map((file) => (
        <FilePreviewCard key={file.path} file={file} onFileClick={onFileClick} readFile={readFile} readFileBinary={readFileBinary} />
      ))}
    </div>
  );
}
