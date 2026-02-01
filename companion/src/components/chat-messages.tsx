import { useEffect, useRef, useMemo, memo } from "react";
import type { ChatMessage, MessagePart, ToolResultPart } from "@/hooks/use-gateway";
import { StreamingDots } from "./streaming-dots";
import { FileCards } from "./file-cards";
import { Loader2 } from "lucide-react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";

type Props = {
  messages: ChatMessage[];
  stream: string | null;
  streamParts: MessagePart[];
  busy: boolean;
  onFileClick?: (path: string) => void;
  readFile?: (path: string) => Promise<string>;
  readFileBinary?: (path: string) => Promise<ArrayBuffer>;
};

function buildToolResultMap(parts: MessagePart[]): Map<string, ToolResultPart> {
  const map = new Map<string, ToolResultPart>();
  for (const p of parts) {
    if (p.type === "toolResult") {
      map.set(p.toolCallId, p);
    }
  }
  return map;
}

const AssistantMessage = memo(function AssistantMessage({
  parts,
  isAnimating,
  resultMap,
  onFileClick,
  readFile,
  readFileBinary,
}: {
  parts: MessagePart[];
  isAnimating: boolean;
  resultMap: Map<string, ToolResultPart>;
  onFileClick?: (path: string) => void;
  readFile?: (path: string) => Promise<string>;
  readFileBinary?: (path: string) => Promise<ArrayBuffer>;
}) {
  const hasText = parts.some((p) => p.type === "text" && p.text);
  const hasToolCalls = parts.some((p) => p.type === "toolCall");
  const allToolsDone = hasToolCalls && parts.filter((p) => p.type === "toolCall").every((p) => resultMap.has(p.toolCallId));
  const showWorking = isAnimating && hasToolCalls && !allToolsDone && !hasText;

  return (
    <>
      {showWorking && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Working...</span>
        </div>
      )}
      {parts.map((part, i) => {
        if (part.type === "text" && part.text) {
          return (
            <Streamdown key={i} plugins={{ code }} isAnimating={isAnimating} linkSafety={{ enabled: false }}>
              {part.text}
            </Streamdown>
          );
        }
        return null;
      })}
      {onFileClick && readFile && readFileBinary && (
        <FileCards parts={parts} resultMap={resultMap} onFileClick={onFileClick} readFile={readFile} readFileBinary={readFileBinary} />
      )}
    </>
  );
});

export function ChatMessages({ messages, stream, streamParts, busy, onFileClick, readFile, readFileBinary }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  const messageResultMap = useMemo(() => {
    return buildToolResultMap(messages.flatMap((m) => m.parts));
  }, [messages]);

  const streamResultMap = useMemo(() => {
    if (streamParts.length === 0) {
      return messageResultMap;
    }
    const map = new Map(messageResultMap);
    for (const p of streamParts) {
      if (p.type === "toolResult") {
        map.set(p.toolCallId, p);
      }
    }
    return map;
  }, [messageResultMap, streamParts]);

  const visibleMessages = useMemo(() =>
    messages.filter((m) => {
      if (m.role === "user") {
        return true;
      }
      return m.parts.some((p) => p.type === "text" && p.text);
    }),
  [messages]);

  const lastVisibleRole = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1].role : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: mounted.current ? "smooth" : "instant" });
    mounted.current = true;
  }, [messages, stream]);

  return (
    <div className="flex-1 overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,black_16px,black_calc(100%-16px),transparent)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-0 px-6">
        {visibleMessages.map((m, i) => {
          const sameAsPrev = i > 0 && visibleMessages[i - 1].role === m.role;
          const gap = sameAsPrev ? "mt-2" : "mt-4";

          if (m.role === "user") {
            return (
              <div key={i} className={`flex justify-end ${gap}`}>
                <div className="max-w-[80%] rounded-3xl rounded-br-[4px] bg-card px-4 py-4 shadow-[var(--shadow-soft)] overflow-hidden">
                  <p className="whitespace-pre-wrap break-words overflow-hidden leading-relaxed">
                    {m.text}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div key={i} className={gap}>
              {m.parts.length > 0 && m.parts.some((p) => p.type !== "text" || p.text) ? (
                <AssistantMessage parts={m.parts} isAnimating={false} resultMap={messageResultMap} onFileClick={onFileClick} readFile={readFile} readFileBinary={readFileBinary} />
              ) : m.text ? (
                <Streamdown plugins={{ code }} isAnimating={false} linkSafety={{ enabled: false }}>
                  {m.text}
                </Streamdown>
              ) : null}
            </div>
          );
        })}
        {(stream || streamParts.length > 0) && (
          <div className={lastVisibleRole === "assistant" ? "mt-1" : "mt-3"}>
            {streamParts.some((p) => p.type !== "text") ? (
              <AssistantMessage parts={streamParts} isAnimating={true} resultMap={streamResultMap} onFileClick={onFileClick} readFile={readFile} readFileBinary={readFileBinary} />
            ) : (
              <Streamdown plugins={{ code }} isAnimating={true} linkSafety={{ enabled: false }}>
                {stream}
              </Streamdown>
            )}
          </div>
        )}
        {busy && !stream && streamParts.length === 0 && (
          <div className={lastVisibleRole === "assistant" ? "mt-1" : "mt-3"}>
            <StreamingDots />
          </div>
        )}
        <div ref={bottomRef} className="pb-6" />
      </div>
    </div>
  );
}
