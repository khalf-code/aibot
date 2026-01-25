export const CLAUDE_AGENT_SDK_TOOL_NAMES = [
    // Tool names are sourced from Claude Code "Tools available to Claude" and the Agent SDK ToolInput union.
    "Task",
    "AskUserQuestion",
    "Bash",
    "BashOutput",
    "Edit",
    "LS",
    "MultiEdit",
    "NotebookRead",
    "Read",
    "Write",
    "Glob",
    "Grep",
    "KillShell",
    "NotebookEdit",
    "WebFetch",
    "WebSearch",
    "TodoWrite",
    "ExitPlanMode",
    "Skill",
    "SlashCommand",
    "ListMcpResources",
    "ReadMcpResource",
];
const TOOL_NAME_BY_LOWER = Object.fromEntries(CLAUDE_AGENT_SDK_TOOL_NAMES.map((name) => [name.toLowerCase(), name]));
// Minor aliasing for tool names that differ between docs/SDK versions.
const TOOL_ALIASES_BY_LOWER = {
    killshell: "KillShell",
    kill_shell: "KillShell",
};
export function canonicalizeClaudeAgentSdkToolName(name) {
    const trimmed = name.trim();
    if (!trimmed)
        return "";
    const lower = trimmed.toLowerCase();
    const aliased = TOOL_ALIASES_BY_LOWER[lower];
    if (aliased)
        return aliased;
    return TOOL_NAME_BY_LOWER[lower] ?? trimmed;
}
export function canonicalizeClaudeAgentSdkToolRule(rule) {
    const trimmed = rule.trim();
    if (!trimmed)
        return "";
    if (trimmed === "*")
        return "*";
    const openParen = trimmed.indexOf("(");
    if (openParen === -1)
        return canonicalizeClaudeAgentSdkToolName(trimmed);
    const base = trimmed.slice(0, openParen).trim();
    const rest = trimmed.slice(openParen);
    const canonical = canonicalizeClaudeAgentSdkToolName(base);
    return canonical ? `${canonical}${rest}` : trimmed;
}
export const CODING_TASK_READONLY_ALLOWED_TOOLS = [
    "LS",
    "Glob",
    "Grep",
    "Read",
    "NotebookRead",
];
export const CODING_TASK_CLAUDE_CODE_ALLOWED_TOOLS = [
    // Task management
    "Task",
    // Repo navigation / reading
    "LS",
    "Glob",
    "Grep",
    "Read",
    "NotebookRead",
    // Edits
    "Edit",
    "MultiEdit",
    "Write",
    "NotebookEdit",
    // Web
    "WebFetch",
    "WebSearch",
    // Shell
    "Bash",
    "BashOutput",
    "KillShell",
    // Misc
    "TodoWrite",
    "Skill",
    "SlashCommand",
];
// Tools that are often interactive in Claude Code and generally don't work well inside a non-interactive tool call.
export const CODING_TASK_DEFAULT_DISALLOWED_TOOLS = ["AskUserQuestion", "ExitPlanMode"];
