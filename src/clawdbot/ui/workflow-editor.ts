/**
 * UI-007 (#68) -- Workflow editor (MVP: YAML with validation)
 *
 * Type definitions for the in-browser YAML workflow editor. The MVP
 * provides syntax highlighting, real-time validation, and basic
 * auto-complete for skill names and trigger types.
 */

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Severity level of a validation diagnostic. */
export type ValidationSeverity = "error" | "warning" | "info";

/** A single validation diagnostic (error, warning, or informational). */
export type ValidationDiagnostic = {
  /** Severity level. */
  severity: ValidationSeverity;
  /** Human-readable message describing the issue. */
  message: string;
  /** 1-based line number where the issue was found. */
  line: number;
  /** 1-based column number where the issue starts. */
  column: number;
  /** Optional end line (for range highlighting). */
  endLine?: number;
  /** Optional end column. */
  endColumn?: number;
  /** Machine-readable rule identifier (e.g. `"missing-trigger"`, `"unknown-skill"`). */
  ruleId?: string;
};

/** Aggregate result of validating the editor content. */
export type ValidationResult = {
  /** Whether the document is valid (no errors; warnings are allowed). */
  valid: boolean;
  /** All diagnostics found during validation. */
  diagnostics: ValidationDiagnostic[];
  /** Number of error-level diagnostics. */
  errorCount: number;
  /** Number of warning-level diagnostics. */
  warningCount: number;
};

// ---------------------------------------------------------------------------
// Editor actions
// ---------------------------------------------------------------------------

/** Actions the user can perform in the editor. */
export type EditorActionType = "save" | "save_draft" | "validate" | "deploy" | "revert" | "format";

/** An action dispatched from the editor toolbar or keyboard shortcut. */
export type EditorAction = {
  /** The kind of action. */
  type: EditorActionType;
  /** ISO-8601 timestamp when the action was triggered. */
  timestamp: string;
};

// ---------------------------------------------------------------------------
// Editor state
// ---------------------------------------------------------------------------

/** A snapshot of undo/redo history. */
export type EditorHistoryEntry = {
  /** The YAML content at this point in history. */
  content: string;
  /** ISO-8601 timestamp of when this snapshot was taken. */
  timestamp: string;
};

/** Complete state of the workflow YAML editor. */
export type EditorState = {
  /** Current YAML content in the editor buffer. */
  content: string;
  /** The last-saved YAML content (for dirty-state detection). */
  savedContent: string;
  /** Whether the buffer has unsaved changes. */
  dirty: boolean;
  /** Current cursor position (1-based line). */
  cursorLine: number;
  /** Current cursor position (1-based column). */
  cursorColumn: number;
  /** Most recent validation result (undefined if never validated). */
  validation?: ValidationResult;
  /** Whether validation is currently running. */
  validating: boolean;
  /** Whether a save operation is in progress. */
  saving: boolean;
  /** Undo history stack. */
  undoStack: EditorHistoryEntry[];
  /** Redo history stack. */
  redoStack: EditorHistoryEntry[];
};

// ---------------------------------------------------------------------------
// Editor configuration
// ---------------------------------------------------------------------------

/** Configuration for the workflow editor. */
export type WorkflowEditorConfig = {
  /** Whether to validate on every keystroke (debounced). */
  validateOnType: boolean;
  /** Debounce delay for on-type validation in milliseconds. */
  validateDebounceMs: number;
  /** Whether to auto-format on save. */
  formatOnSave: boolean;
  /** Tab size in spaces. */
  tabSize: number;
  /** Whether to insert spaces instead of tabs. */
  insertSpaces: boolean;
  /** Whether to show line numbers. */
  showLineNumbers: boolean;
  /** Whether to enable minimap. */
  showMinimap: boolean;
  /** Whether to word-wrap long lines. */
  wordWrap: boolean;
  /** Font size in pixels. */
  fontSizePx: number;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default editor configuration. */
export const DEFAULT_EDITOR_CONFIG: WorkflowEditorConfig = {
  validateOnType: true,
  validateDebounceMs: 500,
  formatOnSave: true,
  tabSize: 2,
  insertSpaces: true,
  showLineNumbers: true,
  showMinimap: false,
  wordWrap: true,
  fontSizePx: 14,
};

/** Create a fresh, empty editor state. */
export function createEmptyEditorState(): EditorState {
  return {
    content: "",
    savedContent: "",
    dirty: false,
    cursorLine: 1,
    cursorColumn: 1,
    validating: false,
    saving: false,
    undoStack: [],
    redoStack: [],
  };
}
