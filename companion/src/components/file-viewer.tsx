import { useState, useRef, useEffect } from "react";
import { X, Download, Maximize2, FileText, FileCode, FileImage, FileSpreadsheet, Presentation, File, RotateCw } from "lucide-react";
import { getFileExtension, isHtml, isImage, isBinary, isSpreadsheet, isWordDoc, isPdf, isPptx, useHighlightedHtml } from "@/hooks/use-highlight";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import JSZip from "jszip";

export type CanvasFile = {
  path: string;
  content: string;
};

type Props = {
  files: CanvasFile[];
  onClose: (path: string) => void;
  onCloseAll: () => void;
  onFullscreen: (file: CanvasFile) => void;
  onReload: (path: string) => void;
  readFileBinary: (path: string) => Promise<ArrayBuffer>;
};

export function getFileIcon(path: string) {
  const ext = getFileExtension(path);
  if (isSpreadsheet(ext)) {
    return FileSpreadsheet;
  }
  if (isPptx(ext)) {
    return Presentation;
  }
  if (isHtml(path)) {
    return FileText;
  }
  if (isImage(ext)) {
    return FileImage;
  }
  if (isBinary(ext)) {
    return File;
  }
  return FileCode;
}

function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function SpreadsheetPreview({ path, readFileBinary, compact }: { path: string; readFileBinary: (p: string) => Promise<ArrayBuffer>; compact?: boolean }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) {
      return;
    }
    fetched.current = true;
    readFileBinary(path)
      .then((buf) => {
        const wb = XLSX.read(buf, { type: "array", ...(compact ? { sheetRows: 10 } : {}) });
        const ws = wb.Sheets[wb.SheetNames[0]];
        setHtml(XLSX.utils.sheet_to_html(ws));
      })
      .catch(() => { setError(true); });
  }, [path, readFileBinary, compact]);

  if (error) {
    return <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Failed to load spreadsheet</div>;
  }
  if (!html) {
    return <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  }
  return (
    <div
      className={compact
        ? "size-full overflow-hidden p-1 text-[7px] leading-tight [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-1 [&_td]:py-0.5 [&_th]:border [&_th]:border-border [&_th]:px-1 [&_th]:py-0.5 [&_th]:bg-muted/50 [&_th]:font-medium [&_tr:nth-child(even)_td]:bg-muted/30"
        : "size-full overflow-auto p-2 text-sm [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted/50 [&_th]:text-left [&_th]:font-medium [&_tr:nth-child(even)_td]:bg-muted/30"
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function WordPreview({ path, readFileBinary, compact }: { path: string; readFileBinary: (p: string) => Promise<ArrayBuffer>; compact?: boolean }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) {
      return;
    }
    fetched.current = true;
    readFileBinary(path)
      .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
      .then((result) => { setHtml(result.value); })
      .catch(() => { setError(true); });
  }, [path, readFileBinary]);

  if (error) {
    return <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Failed to load document</div>;
  }
  if (!html) {
    return <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  }
  return (
    <div
      className={compact
        ? "size-full overflow-hidden p-2 text-[7px] leading-tight [&_p]:m-0 [&_h1]:text-[9px] [&_h2]:text-[8px] [&_h3]:text-[8px] [&_li]:ml-2"
        : "size-full overflow-auto p-4 prose prose-sm max-w-none"
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function PdfPreview({ path, readFileBinary }: { path: string; readFileBinary: (p: string) => Promise<ArrayBuffer> }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) {
      return;
    }
    fetched.current = true;
    readFileBinary(path)
      .then((buf) => {
        const blob = new Blob([buf], { type: "application/pdf" });
        setBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => { setError(true); });
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [path, readFileBinary]);

  if (error) {
    return <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Failed to load PDF</div>;
  }
  if (!blobUrl) {
    return <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  }
  return <iframe src={blobUrl} className="size-full border-0" title={path} />;
}

function PptxPreview({ path, readFileBinary }: { path: string; readFileBinary: (p: string) => Promise<ArrayBuffer> }) {
  const [slides, setSlides] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [current, setCurrent] = useState(0);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) {
      return;
    }
    fetched.current = true;
    readFileBinary(path)
      .then(async (buf) => {
        const zip = await JSZip.loadAsync(buf);
        const urls: string[] = [];
        const thumbnail = zip.file("docProps/thumbnail.jpeg") ?? zip.file("docProps/thumbnail.png");
        if (thumbnail) {
          const blob = await thumbnail.async("blob");
          urls.push(URL.createObjectURL(blob));
        }
        const slideFiles = Object.keys(zip.files)
          .filter((f) => /^ppt\/media\/image\d+\.(png|jpeg|jpg|gif|emf|wmf)$/i.test(f))
          .toSorted();
        for (const f of slideFiles) {
          const blob = await zip.file(f)!.async("blob");
          urls.push(URL.createObjectURL(blob));
        }
        if (urls.length === 0) {
          throw new Error("no slides");
        }
        setSlides(urls);
      })
      .catch(() => { setError(true); });
    return () => { slides.forEach(URL.revokeObjectURL); };
  }, [path, readFileBinary]);

  if (error) {
    return <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Failed to load presentation</div>;
  }
  if (slides.length === 0) {
    return <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  }
  return (
    <div className="flex size-full flex-col">
      <div className="flex flex-1 items-center justify-center overflow-hidden bg-card p-4">
        <img src={slides[current]} alt={`Slide ${current + 1}`} className="max-h-full max-w-full object-contain" />
      </div>
      {slides.length > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-border py-2">
          <button
            className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
            disabled={current === 0}
            onClick={() => setCurrent((c) => c - 1)}
          >
            Prev
          </button>
          <span className="text-xs text-muted-foreground">{current + 1} / {slides.length}</span>
          <button
            className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
            disabled={current === slides.length - 1}
            onClick={() => setCurrent((c) => c + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function BinaryPlaceholder({ path, readFileBinary }: { path: string; readFileBinary: (p: string) => Promise<ArrayBuffer> }) {
  const fileName = path.split("/").pop() ?? path;

  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <File className="size-10 opacity-40" />
      <p className="text-sm">Preview is not available</p>
      <button
        className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
        onClick={() => {
          readFileBinary(path)
            .then((buf) => downloadBlob(new Blob([buf]), fileName))
            .catch(() => {});
        }}
      >
        Download file
      </button>
    </div>
  );
}

export function FileContentPreview({ path, content, readFileBinary, compact }: {
  path: string;
  content: string;
  readFileBinary: (p: string) => Promise<ArrayBuffer>;
  compact?: boolean;
}) {
  const ext = getFileExtension(path);
  const fileName = path.split("/").pop() ?? path;
  const html = isHtml(path);
  const highlighted = useHighlightedHtml(!isBinary(ext) ? (compact ? content.slice(0, 500) : content) : null, ext);

  if (isSpreadsheet(ext)) {
    return <SpreadsheetPreview path={path} readFileBinary={readFileBinary} compact={compact} />;
  }
  if (isWordDoc(ext)) {
    return <WordPreview path={path} readFileBinary={readFileBinary} compact={compact} />;
  }
  if (isPptx(ext)) {
    if (compact) {
      return <BinaryIconPlaceholder ext={ext} />;
    }
    return <PptxPreview path={path} readFileBinary={readFileBinary} />;
  }
  if (isPdf(ext)) {
    if (compact) {
      return <BinaryIconPlaceholder ext={ext} />;
    }
    return <PdfPreview path={path} readFileBinary={readFileBinary} />;
  }
  if (isBinary(ext)) {
    if (compact) {
      return <BinaryIconPlaceholder ext={ext} />;
    }
    return <BinaryPlaceholder path={path} readFileBinary={readFileBinary} />;
  }
  if (html) {
    return (
      <iframe
        srcDoc={content}
        className={`size-full border-0 ${compact ? "pointer-events-none" : ""}`}
        sandbox={compact ? "" : "allow-scripts allow-popups allow-popups-to-escape-sandbox"}
        title={fileName}
        {...(compact ? { style: { transform: "scale(0.5)", transformOrigin: "0 0", width: "200%", height: "200%" } } : {})}
      />
    );
  }
  if (highlighted) {
    return (
      <div
        className={compact
          ? "size-full overflow-hidden p-2 text-[8px] leading-tight [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_code]:!text-[8px]"
          : "size-full overflow-auto p-3 text-sm leading-relaxed [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_code]:!text-sm"
        }
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    );
  }
  return compact
    ? <pre className="size-full overflow-hidden p-2 text-[8px] leading-tight text-muted-foreground">{content.slice(0, 500)}</pre>
    : <div className="size-full overflow-auto p-3"><pre className="text-sm leading-relaxed whitespace-pre-wrap break-all text-foreground">{content}</pre></div>;
}

function BinaryIconPlaceholder({ ext }: { ext: string }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-1">
      <File className="size-6 text-muted-foreground/30" />
      <span className="text-[10px] font-medium text-muted-foreground/60 uppercase">.{ext}</span>
    </div>
  );
}

function FileWindow({ file, onClose, onFullscreen, onReload, solo, readFileBinary }: { file: CanvasFile; onClose: () => void; onFullscreen: () => void; onReload: () => void; solo?: boolean; readFileBinary: (p: string) => Promise<ArrayBuffer> }) {
  const reloadRef = useRef<SVGSVGElement>(null);
  const fileName = file.path.split("/").pop() ?? file.path;
  const ext = getFileExtension(file.path);
  const Icon = getFileIcon(file.path);
  const _html = isHtml(file.path);

  const handleReload = () => {
    reloadRef.current?.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 300, easing: "ease-out" });
    onReload();
  };

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-card ${solo ? "h-full" : ""}`}>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm font-medium">{fileName}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Reload"
            onClick={handleReload}
          >
            <RotateCw ref={reloadRef} className="size-3.5" />
          </button>
          <button
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Fullscreen"
            onClick={onFullscreen}
          >
            <Maximize2 className="size-3.5" />
          </button>
          <button
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Download"
            onClick={() => {
              if (isBinary(ext)) {
                readFileBinary(file.path)
                  .then((buf) => downloadBlob(new Blob([buf]), fileName))
                  .catch(() => {});
              } else {
                downloadBlob(new Blob([file.content], { type: "text/plain" }), fileName);
              }
            }}
          >
            <Download className="size-3.5" />
          </button>
          <button
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className={`relative overflow-hidden bg-white ${solo ? "flex-1" : "h-[200px]"}`}>
        <FileContentPreview path={file.path} content={file.content} readFileBinary={readFileBinary} />
      </div>
    </div>
  );
}

export function FileViewer({ files, onClose, onCloseAll: _onCloseAll, onFullscreen, onReload, readFileBinary }: Props) {
  const count = files.length;
  const cols = count <= 2 ? 1 : 2;
  const maxVisible = 8;
  const fits = count <= maxVisible;
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fits) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [files.length, fits]);

  return (
    <div className={`h-full p-2 ${fits ? "" : "overflow-y-auto"}`}>
      <div
        className={`grid gap-2 ${fits ? "h-full" : ""}`}
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          ...(fits
            ? { gridTemplateRows: `repeat(${Math.ceil(count / cols)}, minmax(0, 1fr))` }
            : { gridAutoRows: "240px" }),
        }}
      >
        {files.map((file) => (
          <FileWindow key={file.path} file={file} onClose={() => onClose(file.path)} onFullscreen={() => onFullscreen(file)} onReload={() => onReload(file.path)} solo={fits} readFileBinary={readFileBinary} />
        ))}
      </div>
      {!fits && <div ref={bottomRef} />}
    </div>
  );
}
