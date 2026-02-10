import { Type } from "@sinclair/typebox";
import { truncateUtf16Safe } from "../../utils.js";
import {
  type AnyAgentTool,
  jsonResult,
  readNumberParam,
  readStringArrayParam,
  readStringParam,
} from "./common.js";

const DEFAULT_MAX_CHARS = 2000;
const TRUNCATION_HINT = "提示: 用 offset 翻页查看更多";
const BLOCKED_FIELD_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

type SafeCallPolicy = {
  allowWrapping?: boolean;
  allowedParams?: Set<string>;
};

const SafeCallToolSchema = Type.Object({
  tool: Type.String(),
  params: Type.Optional(Type.Object({}, { additionalProperties: true })),
  maxChars: Type.Optional(Type.Number({ minimum: 1 })),
  offset: Type.Optional(Type.Number({ minimum: 0 })),
  limit: Type.Optional(Type.Number({ minimum: 1 })),
  fields: Type.Optional(Type.Array(Type.String())),
});

type SafeCallToolOptions = {
  resolveTool: (name: string) => AnyAgentTool | undefined;
};

type PageResult = {
  mode: "array" | "lines";
  totalItems: number;
  hasMore: boolean;
  nextOffset?: number;
  output: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createNullProtoRecord(): Record<string, unknown> {
  return Object.create(null) as Record<string, unknown>;
}

function parseFieldPath(field: string): string[] {
  const path = field
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (path.length === 0) {
    return [];
  }
  const blockedSegment = path.find((segment) => BLOCKED_FIELD_SEGMENTS.has(segment));
  if (blockedSegment) {
    throw new Error(`Unsafe field path segment: ${blockedSegment}`);
  }
  return path;
}

function normalizeFields(fields: string[] | undefined): { names: string[]; paths: string[][] } {
  if (!fields || fields.length === 0) {
    return { names: [], paths: [] };
  }

  const names: string[] = [];
  const paths: string[][] = [];
  const seen = new Set<string>();

  for (const field of fields) {
    const path = parseFieldPath(field);
    if (path.length === 0) {
      continue;
    }
    const normalized = path.join(".");
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    names.push(normalized);
    paths.push(path);
  }

  return { names, paths };
}

function getPathValue(source: unknown, path: string[]): unknown {
  let current: unknown = source;
  for (const segment of path) {
    if (!isRecord(current) || !Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function setPathValue(target: Record<string, unknown>, path: string[], value: unknown) {
  let current: Record<string, unknown> = target;
  for (let index = 0; index < path.length; index += 1) {
    const key = path[index];
    if (!key || BLOCKED_FIELD_SEGMENTS.has(key)) {
      return;
    }
    const isLeaf = index === path.length - 1;
    if (isLeaf) {
      current[key] = value;
      return;
    }

    const existing = current[key];
    if (!isRecord(existing)) {
      const nextRecord = createNullProtoRecord();
      current[key] = nextRecord;
      current = nextRecord;
      continue;
    }
    current = existing;
  }
}

function pickFieldsFromRecord(value: Record<string, unknown>, fieldPaths: string[][]) {
  const picked = createNullProtoRecord();
  for (const path of fieldPaths) {
    const selected = getPathValue(value, path);
    if (selected === undefined) {
      continue;
    }
    setPathValue(picked, path, selected);
  }
  return picked;
}

function applyFieldsToValue(value: unknown, fieldPaths: string[][]): unknown {
  if (fieldPaths.length === 0) {
    return value;
  }
  if (isRecord(value)) {
    return pickFieldsFromRecord(value, fieldPaths);
  }
  return value;
}

function applyFieldsToArrayWindow(items: unknown[], fieldPaths: string[][]): unknown[] {
  if (fieldPaths.length === 0) {
    return items;
  }
  return items.map((entry) => (isRecord(entry) ? pickFieldsFromRecord(entry, fieldPaths) : entry));
}

function paginateArray(items: unknown[], offset: number, limit?: number): PageResult {
  const totalItems = items.length;
  const end = typeof limit === "number" ? offset + limit : totalItems;
  const sliced = items.slice(offset, end);
  const hasMore = end < totalItems;
  return {
    mode: "array",
    totalItems,
    hasMore,
    nextOffset: hasMore ? end : undefined,
    output: sliced,
  };
}

function lineBreakLength(raw: string, index: number): number {
  const code = raw.charCodeAt(index);
  if (code === 0x0d) {
    return raw.charCodeAt(index + 1) === 0x0a ? 2 : 1;
  }
  if (code === 0x0a) {
    return 1;
  }
  return 0;
}

function paginateLines(raw: string, offset: number, limit?: number): PageResult {
  const end = typeof limit === "number" ? offset + limit : Number.POSITIVE_INFINITY;
  const pageLines: string[] = [];

  let totalItems = 0;
  let lineStart = 0;

  for (let index = 0; index <= raw.length; ) {
    const atEnd = index === raw.length;
    const breakLen = atEnd ? 0 : lineBreakLength(raw, index);
    if (!atEnd && breakLen === 0) {
      index += 1;
      continue;
    }

    if (totalItems >= offset && totalItems < end) {
      pageLines.push(raw.slice(lineStart, index));
    }
    totalItems += 1;

    if (atEnd) {
      break;
    }

    index += breakLen;
    lineStart = index;
  }

  const boundedEnd = Number.isFinite(end) ? end : totalItems;
  const hasMore = boundedEnd < totalItems;
  return {
    mode: "lines",
    totalItems,
    hasMore,
    nextOffset: hasMore ? boundedEnd : undefined,
    output: pageLines.join("\n"),
  };
}

function serializeOutput(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isHighSurrogate(codePoint: number): boolean {
  return codePoint >= 0xd800 && codePoint <= 0xdbff;
}

function isLowSurrogate(codePoint: number): boolean {
  return codePoint >= 0xdc00 && codePoint <= 0xdfff;
}

function sliceTailUtf16Safe(text: string, maxChars: number): string {
  if (maxChars <= 0) {
    return "";
  }
  let start = Math.max(0, text.length - maxChars);
  if (start > 0 && start < text.length) {
    const previous = text.charCodeAt(start - 1);
    const current = text.charCodeAt(start);
    if (isHighSurrogate(previous) && isLowSurrogate(current)) {
      start += 1;
    }
  }
  return text.slice(start);
}

function truncateWithHeadTail(
  text: string,
  maxChars: number,
): { output: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { output: text, truncated: false };
  }
  if (maxChars <= 0) {
    return { output: "", truncated: true };
  }

  const divider = `\n...\n${TRUNCATION_HINT}\n...\n`;
  if (maxChars <= divider.length + 2) {
    return {
      output: truncateUtf16Safe(text, maxChars),
      truncated: true,
    };
  }

  const edge = Math.max(1, Math.floor((maxChars - divider.length) / 2));
  const head = truncateUtf16Safe(text, edge);
  const tail = truncateUtf16Safe(sliceTailUtf16Safe(text, edge), edge);
  let output = `${head}${divider}${tail}`;
  if (output.length > maxChars) {
    output = truncateUtf16Safe(output, maxChars);
  }
  return { output, truncated: true };
}

function extractPayload(result: unknown): unknown {
  if (!isRecord(result)) {
    return result;
  }
  if ("details" in result && result.details != null) {
    return result.details;
  }

  const content = result.content;
  if (Array.isArray(content)) {
    const textBlocks = content
      .filter((entry) => isRecord(entry) && entry.type === "text" && typeof entry.text === "string")
      .map((entry) => String((entry as { text?: unknown }).text));
    if (textBlocks.length > 0) {
      return textBlocks.join("\n");
    }
  }

  return result;
}

function readSafeCallPolicy(tool: AnyAgentTool): SafeCallPolicy {
  const toolRecord = tool as unknown as Record<string, unknown>;
  const policyRaw = toolRecord.safeCall;
  if (!isRecord(policyRaw)) {
    return {};
  }

  const allowWrapping =
    typeof policyRaw.allowWrapping === "boolean" ? policyRaw.allowWrapping : undefined;

  const allowedParamsRaw = policyRaw.allowedParams;
  const allowedParams = Array.isArray(allowedParamsRaw)
    ? new Set(
        allowedParamsRaw
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean),
      )
    : undefined;

  return { allowWrapping, allowedParams };
}

function selectTargetParams(
  params: Record<string, unknown>,
  allowedParams: Set<string> | undefined,
): Record<string, unknown> {
  if (!allowedParams || allowedParams.size === 0) {
    return params;
  }
  const selected = createNullProtoRecord();
  for (const key of allowedParams) {
    if (Object.hasOwn(params, key)) {
      selected[key] = params[key];
    }
  }
  return selected;
}

export function createSafeCallTool(options: SafeCallToolOptions): AnyAgentTool {
  return {
    label: "Safe Call",
    name: "safe_call",
    description:
      "Call another tool and safely post-process its output with field filtering, pagination, and maxChars truncation.",
    parameters: SafeCallToolSchema,
    execute: async (toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const toolName = readStringParam(params, "tool", { required: true });
      if (toolName === "safe_call") {
        throw new Error("safe_call cannot wrap itself");
      }

      const target = options.resolveTool(toolName);
      if (!target) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      const policy = readSafeCallPolicy(target);
      if (policy.allowWrapping === false) {
        throw new Error(`Tool does not allow safe_call wrapping: ${toolName}`);
      }

      const targetParamsRaw = params.params;
      const targetParamsSource = isRecord(targetParamsRaw) ? targetParamsRaw : {};
      // Security boundary: safe_call forwards tool-specific params by default; target tools may
      // opt into stricter wrapping via `safeCall.allowWrapping` and `safeCall.allowedParams`.
      const targetParams = selectTargetParams(targetParamsSource, policy.allowedParams);

      const requestedOffset = readNumberParam(params, "offset", { integer: true }) ?? 0;
      const requestedLimit = readNumberParam(params, "limit", { integer: true });
      const requestedMaxChars = readNumberParam(params, "maxChars", { integer: true });
      const requestedFields = readStringArrayParam(params, "fields");
      const normalizedFields = normalizeFields(requestedFields);

      const offset = Math.max(0, requestedOffset);
      const limit =
        typeof requestedLimit === "number" && Number.isFinite(requestedLimit)
          ? Math.max(1, requestedLimit)
          : undefined;
      const maxChars =
        typeof requestedMaxChars === "number" && Number.isFinite(requestedMaxChars)
          ? Math.max(1, requestedMaxChars)
          : DEFAULT_MAX_CHARS;

      const targetResult = await target.execute(
        `${toolCallId}:safe_call:${toolName}`,
        targetParams,
      );
      const payload = extractPayload(targetResult);

      let page: PageResult;
      if (Array.isArray(payload)) {
        const paged = paginateArray(payload, offset, limit);
        page = {
          ...paged,
          output: applyFieldsToArrayWindow(paged.output as unknown[], normalizedFields.paths),
        };
      } else {
        const selected = applyFieldsToValue(payload, normalizedFields.paths);
        page = paginateLines(serializeOutput(selected), offset, limit);
      }

      const serialized = serializeOutput(page.output);
      const truncated = truncateWithHeadTail(serialized, maxChars);

      return jsonResult({
        tool: toolName,
        mode: page.mode,
        totalItems: page.totalItems,
        hasMore: page.hasMore,
        nextOffset: page.nextOffset,
        offset,
        limit: limit ?? null,
        maxChars,
        fields: normalizedFields.names,
        truncated: truncated.truncated,
        output: truncated.output,
      });
    },
  };
}
