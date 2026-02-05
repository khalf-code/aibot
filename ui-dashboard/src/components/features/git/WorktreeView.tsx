import { useState, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Badge } from '../../ui';
import { cn } from '@/lib/utils';
import { gateway } from '../../../lib/gateway';

interface GitWorktree {
  path: string;
  head: string;
  branch: string;
}

interface GitBranch {
  name: string;
  sha: string;
}

interface DiffFileStat {
  path: string;
  additions: number;
  deletions: number;
}

interface DiffStats {
  filesChanged: number;
  additions: number;
  deletions: number;
}

export function WorktreeView() {
  const [worktrees, setWorktrees] = useState<GitWorktree[]>([]);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [selectedWorktreeIdx, setSelectedWorktreeIdx] = useState<number | null>(null);
  const [diffContent, setDiffContent] = useState<string>('');
  const [diffStats, setDiffStats] = useState<DiffStats>({ filesChanged: 0, additions: 0, deletions: 0 });
  const [gitStatus, setGitStatus] = useState<{ branch: string; ahead: number; behind: number; files: { path: string; status: string }[] } | null>(null);

  // Load git data on mount
  useEffect(() => {
    Promise.all([
      gateway.callMethod('dashboard.git.worktrees', {}),
      gateway.callMethod('dashboard.git.branches', {}),
      gateway.callMethod('dashboard.git.status', {}),
    ]).then(
      ([wtData, brData, stData]) => {
        const wt = wtData as { worktrees: GitWorktree[] };
        const br = brData as { branches: GitBranch[]; current: string };
        const st = stData as { branch: string; ahead: number; behind: number; files: { path: string; status: string }[] };
        setWorktrees(wt.worktrees ?? []);
        setBranches(br.branches ?? []);
        setCurrentBranch(br.current ?? '');
        setGitStatus(st);
      },
      (err) => {
        console.warn('[Git] Failed to load data:', err);
      },
    );
  }, []);

  const selectedWorktree = selectedWorktreeIdx != null ? worktrees[selectedWorktreeIdx] : null;

  // Load diff when a worktree is selected
  useEffect(() => {
    if (!selectedWorktree) {
      setDiffContent('');

      setDiffStats({ filesChanged: 0, additions: 0, deletions: 0 });
      return;
    }

    gateway.callMethod('dashboard.git.diff', { base: 'HEAD' }).then(
      (data) => {
        const result = data as { diff: string; files: DiffFileStat[]; stats: DiffStats };
        setDiffContent(result.diff ?? '');

        setDiffStats(result.stats ?? { filesChanged: 0, additions: 0, deletions: 0 });
      },
      (err) => {
        console.warn('[Git] Failed to load diff:', err);
      },
    );
  }, [selectedWorktree]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Git Worktrees</h2>
        <div className="flex gap-2 items-center">
          {gitStatus && (
            <span className="text-[12px] text-[var(--color-text-muted)]">
              {gitStatus.files.length} changed file{gitStatus.files.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Content: sidebar + main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-[280px] shrink-0 flex flex-col border-r border-[var(--color-border)] overflow-y-auto">
          {/* Active Worktrees section */}
          <div className="p-4">
            <div className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
              Active Worktrees
            </div>
            <div className="flex flex-col gap-2">
              {worktrees.length === 0 ? (
                <div className="text-[12px] text-[var(--color-text-muted)] py-2">
                  No worktrees found
                </div>
              ) : (
                worktrees.map((worktree, idx) => (
                  <div
                    key={worktree.path}
                    className={cn(
                      'p-3 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors',
                      selectedWorktreeIdx === idx && 'bg-[var(--color-bg-tertiary)] border-[var(--color-accent)]',
                    )}
                    onClick={() => setSelectedWorktreeIdx(idx)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">&#x2387;</span>
                      <span className="text-[13px] font-medium text-[var(--color-text-primary)] font-mono truncate">
                        {worktree.branch || '(detached)'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)] font-mono mb-2 truncate">
                      {worktree.path}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-secondary)]">
                      <Badge variant="muted" size="sm">
                        {worktree.head.slice(0, 7)}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Branches section */}
          <div className="p-4">
            <div className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
              Branches
            </div>
            <div className="flex flex-col">
              {branches.filter((b) => !b.name.startsWith('origin/')).map((branch) => (
                <div
                  key={branch.name}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-[13px] rounded-md cursor-pointer transition-colors',
                    branch.name === currentBranch
                      ? 'text-[var(--color-accent)] bg-[var(--color-bg-tertiary)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]',
                  )}
                >
                  <span className="text-xs">
                    {branch.name === currentBranch ? '\u25CF' : '\u25CB'}
                  </span>
                  <span className="flex-1 font-mono truncate">{branch.name}</span>
                  {branch.name === currentBranch && gitStatus && (gitStatus.ahead > 0 || gitStatus.behind > 0) && (
                    <Badge variant="muted" size="sm">
                      {gitStatus.ahead > 0 && `${gitStatus.ahead} ahead`}
                      {gitStatus.ahead > 0 && gitStatus.behind > 0 && ', '}
                      {gitStatus.behind > 0 && `${gitStatus.behind} behind`}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col">
          {selectedWorktree ? (
            <>
              {/* Stats bar */}
              <div className="flex items-center gap-3 px-4 py-2 text-[12px] border-b border-[var(--color-border)]">
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {selectedWorktree.branch || 'HEAD'}
                </span>
                <span className="ml-auto text-[var(--color-text-secondary)]">
                  {diffStats.filesChanged} file{diffStats.filesChanged !== 1 ? 's' : ''}
                </span>
                <span className="text-[var(--color-success)]">+{diffStats.additions}</span>
                <span className="text-[var(--color-error)]">-{diffStats.deletions}</span>
              </div>

              {/* Diff content */}
              <div className="flex-1">
                {diffContent ? (
                  <DiffEditor
                    height="100%"
                    language="plaintext"
                    original=""
                    modified={diffContent}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      renderSideBySide: false,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
                    <div className="text-sm">No changes to display</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] text-center">
              <div className="text-5xl mb-4 opacity-50">&#x2387;</div>
              <div>Select a worktree to view changes</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
