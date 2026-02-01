import { useState, useCallback, useEffect, useRef } from "react";
import { useGateway } from "@/hooks/use-gateway";
import { ChatMessages } from "@/components/chat-messages";
import { ChatComposer } from "@/components/chat-composer";
import { FileViewer, FileContentPreview, getFileIcon, type CanvasFile } from "@/components/file-viewer";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getFileExtension, isBinary } from "@/hooks/use-highlight";

import { SquarePen, X, Download } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export default function App() {
  const { connected, lastError, messages, stream, streamParts, busy, send, stop, newSession, historyLoaded, readFile, readFileBinary } = useGateway();
  const hasMessages = messages.length > 0 || stream !== null;
  const [hasInteracted, setHasInteracted] = useState(false);
  const [canvasFiles, setCanvasFiles] = useState<CanvasFile[]>(() => {
    try {
      const saved = localStorage.getItem("companion.canvasFiles");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [dialogFile, setDialogFile] = useState<CanvasFile | null>(null);

  useEffect(() => {
    if (canvasFiles.length === 0) {
      localStorage.removeItem("companion.canvasFiles");
    } else {
      localStorage.setItem("companion.canvasFiles", JSON.stringify(canvasFiles));
    }
  }, [canvasFiles]);

  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy && canvasFiles.length > 0) {
      Promise.all(
        canvasFiles.map(async (f) => {
          try {
            const content = await readFile(f.path);
            return { path: f.path, content };
          } catch {
            return f;
          }
        })
      ).then(setCanvasFiles);
    }
    wasBusy.current = busy;
  }, [busy, canvasFiles.length, readFile]);

  const handleFileClick = useCallback(async (path: string) => {
    let content: string;
    try {
      content = await readFile(path);
    } catch {
      content = "File not found or not readable";
    }
    setCanvasFiles((prev) => {
      const exists = prev.some((f) => f.path === path);
      if (exists) {
        return prev.map((f) => f.path === path ? { path, content } : f);
      }
      return [...prev, { path, content }];
    });
  }, [readFile]);

  const handleCloseFile = useCallback((path: string) => {
    setCanvasFiles((prev) => prev.filter((f) => f.path !== path));
  }, []);

  const handleCloseAll = useCallback(() => {
    setCanvasFiles([]);
  }, []);

  const handleFullscreen = useCallback((file: CanvasFile) => {
    setDialogFile(file);
  }, []);

  const handleReload = useCallback(async (path: string) => {
    try {
      const content = await readFile(path);
      setCanvasFiles((prev) => prev.map((f) => f.path === path ? { path, content } : f));
    } catch {}
  }, [readFile]);

  const showEmpty = historyLoaded && !hasMessages && !hasInteracted;
  const hasCanvas = canvasFiles.length > 0;

  if (!connected && lastError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background font-sans text-foreground">
        <p className="text-3xl font-medium text-muted-foreground mb-4">Not connected</p>
        <p className="text-sm text-muted-foreground mb-4">{lastError}</p>
        <a href="mailto:team@companion.ai" className="text-sm text-primary underline underline-offset-4 hover:opacity-80">
          Contact support
        </a>
      </div>
    );
  }

  const dialogFileName = dialogFile ? (dialogFile.path.split("/").pop() ?? dialogFile.path) : "";
  const dialogExt = dialogFile ? getFileExtension(dialogFile.path) : "";
  const DialogIcon = dialogFile ? getFileIcon(dialogFile.path) : null;

  return (
    <div className="flex h-dvh bg-background font-sans text-foreground">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={hasCanvas ? 55 : 100} minSize={35}>
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center justify-between px-4 py-3">
              <h1 className="text-sm font-semibold">Companion OS</h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={newSession}
                    disabled={!connected}
                  >
                    <SquarePen className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">New session</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              {hasMessages ? (
                <ChatMessages
                  messages={messages}
                  stream={stream}
                  streamParts={streamParts}
                  busy={busy}
                  onFileClick={handleFileClick}
                  readFile={readFile}
                  readFileBinary={readFileBinary}
                />
              ) : (
                <div className="flex-1" />
              )}
            </div>

            {showEmpty && (
              <h1 className="text-center text-3xl sm:text-4xl font-medium text-foreground mb-10">
                What can I do for you?
              </h1>
            )}
            <ChatComposer connected={connected} busy={busy} onSend={(text) => { setHasInteracted(true); send(text); }} onStop={stop} />
            {showEmpty && <div className="flex-[1.5]" />}
          </div>
        </ResizablePanel>

        {hasCanvas && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={45} minSize={20}>
              <FileViewer
                files={canvasFiles}
                onClose={handleCloseFile}
                onCloseAll={handleCloseAll}
                onFullscreen={handleFullscreen}
                onReload={handleReload}
                readFileBinary={readFileBinary}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <Dialog open={dialogFile !== null} onOpenChange={(open) => { if (!open) { setDialogFile(null); } }}>
        {dialogFile && (
          <DialogContent>
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-4">
              {DialogIcon && <DialogIcon className="size-3.5 shrink-0 text-muted-foreground" />}
              <span className="flex-1 truncate text-sm font-medium">{dialogFileName}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Download"
                  onClick={() => {
                    if (isBinary(dialogExt)) {
                      readFileBinary(dialogFile.path)
                        .then((buf) => {
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(new Blob([buf]));
                          a.download = dialogFileName;
                          a.click();
                          URL.revokeObjectURL(a.href);
                        })
                        .catch(() => {});
                    } else {
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(new Blob([dialogFile.content], { type: "text/plain" }));
                      a.download = dialogFileName;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }
                  }}
                >
                  <Download className="size-3.5" />
                </button>
                <button
                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Close"
                  onClick={() => setDialogFile(null)}
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-white">
              <FileContentPreview path={dialogFile.path} content={dialogFile.content} readFileBinary={readFileBinary} />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
