import { useState, useCallback, useEffect } from 'react';
import { Tree } from 'react-arborist';
import Editor from '@monaco-editor/react';
import { ResizableLayout } from '../components/layout';
import { ContextPanel, ContextSection, ContextRow } from '../components/layout';
import { cn } from '@/lib/utils';
import { gateway } from '../lib/gateway';
import type { NodeRendererProps } from 'react-arborist';

// --- Types ---

interface FileTreeNode {
  id: string;
  name: string;
  children: FileTreeNode[] | null;
}

// --- Helpers ---

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- File tree node renderer ---

function FileNode({ node, style, dragHandle }: NodeRendererProps<FileTreeNode>) {
  const isFolder = node.isInternal;

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        'flex items-center gap-1 px-2 py-1 text-[13px] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-bg-tertiary)] rounded-sm',
        node.isSelected && 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]',
      )}
      onClick={() => node.isInternal ? node.toggle() : node.select()}
    >
      <span className="flex-shrink-0 text-sm leading-none">
        {isFolder ? (node.isOpen ? '\u{1F4C2}' : '\u{1F4C1}') : '\u{1F4C4}'}
      </span>
      <span className="truncate">{node.data.name}</span>
    </div>
  );
}

// --- Main view ---

export function FilesView() {
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number>(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('plaintext');
  const [loading, setLoading] = useState(false);

  // Load file tree on mount
  useEffect(() => {
    gateway.callMethod('dashboard.files.tree', {}).then(
      (data) => {
        const result = data as { tree: FileTreeNode[] };
        setFileTree(result.tree ?? []);
      },
      (err) => {
        console.warn('[Files] Failed to load tree:', err);
      },
    );
  }, []);

  const handleActivate = useCallback((node: { id: string; isLeaf: boolean }) => {
    if (!node.isLeaf) return;
    setSelectedFileId(node.id);
    setLoading(true);

    gateway.callMethod('dashboard.files.read', { path: node.id }).then(
      (data) => {
        const result = data as { content: string; name: string; size: number; language: string };
        setSelectedContent(result.content);
        setSelectedFileName(result.name);
        setSelectedFileSize(result.size);
        setSelectedLanguage(result.language);
        setLoading(false);
      },
      (err) => {
        console.error('[Files] Failed to read file:', err);
        setSelectedContent(null);
        setSelectedFileName(null);
        setLoading(false);
      },
    );
  }, []);

  const isFolder = selectedFileId
    ? fileTree.some((n) => findNode(n, selectedFileId)?.children != null)
    : false;
  const selectedPath = selectedFileId;

  return (
    <ResizableLayout
      defaultSidebarSize={20}
      defaultContextSize={20}
      sidebar={
        <div className="h-full flex flex-col overflow-hidden">
          <div className="flex items-center px-4 py-3 border-b border-[var(--color-border)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Explorer
            </span>
          </div>
          <div className="flex-1 overflow-auto py-1">
            {fileTree.length > 0 ? (
              <Tree<FileTreeNode>
                data={fileTree}
                openByDefault={false}
                width="100%"
                height={600}
                indent={16}
                rowHeight={28}
                disableDrag
                disableDrop
                disableEdit
                onActivate={handleActivate}
              >
                {FileNode}
              </Tree>
            ) : (
              <div className="p-4 text-center text-[13px] text-[var(--color-text-muted)]">
                Loading file tree...
              </div>
            )}
          </div>
        </div>
      }
      main={
        <div className="h-full flex flex-col overflow-hidden bg-[var(--color-bg-primary)]">
          {/* Tab bar */}
          <div className="flex items-center h-9 px-3 gap-1 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            {selectedFileName ? (
              <div className="flex items-center gap-1.5 px-2 py-1 text-[12px] text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] rounded-t-sm border border-b-0 border-[var(--color-border)]">
                <span className="text-xs">{'\u{1F4C4}'}</span>
                <span>{selectedFileName}</span>
              </div>
            ) : (
              <span className="text-[12px] text-[var(--color-text-muted)]">No file open</span>
            )}
          </div>
          {/* Editor area */}
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                <div className="text-sm">Loading...</div>
              </div>
            ) : selectedContent != null ? (
              <Editor
                height="100%"
                language={selectedLanguage}
                value={selectedContent}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: true },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
                <div className="text-5xl mb-4 opacity-30">{'\u{1F4C1}'}</div>
                <div className="text-sm">Select a file to view its contents</div>
                <div className="text-xs mt-2 opacity-60">Browse the file tree on the left</div>
              </div>
            )}
          </div>
        </div>
      }
      context={
        <ContextPanel>
          {selectedFileId && selectedFileName && !isFolder ? (
            <>
              <ContextSection title="File Info">
                <ContextRow label="Name" value={selectedFileName} />
                <ContextRow label="Path" value={selectedPath ?? ''} />
                <ContextRow label="Language" value={selectedLanguage} />
                <ContextRow label="Size" value={formatBytes(selectedFileSize)} />
                <ContextRow
                  label="Lines"
                  value={(selectedContent ?? '').split('\n').length}
                />
              </ContextSection>
            </>
          ) : (
            <div className="p-4 text-center text-[13px] text-[var(--color-text-muted)]">
              Select a file to view details
            </div>
          )}
        </ContextPanel>
      }
    />
  );
}

// --- Tree traversal helper ---

function findNode(node: FileTreeNode, id: string): FileTreeNode | null {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}
