export function coerceClaudeAgentSdkQuery(rawQuery) {
    if (typeof rawQuery !== "function") {
        throw new Error("Claude Agent SDK loaded, but `query` export is not a function.");
    }
    // The SDK has had multiple public signatures. Prefer the object-form signature,
    // but fall back to the legacy (prompt, options) form if needed.
    const fn = rawQuery;
    return ({ prompt, options }) => {
        const args = { prompt, options };
        // Heuristic: legacy signature tends to have arity >= 2.
        if (fn.length >= 2)
            return fn(prompt, options);
        try {
            return fn(args);
        }
        catch {
            return fn(prompt, options);
        }
    };
}
export async function loadClaudeAgentSdk() {
    // Intentionally avoid a string-literal dynamic import here so `pnpm build` doesn't
    // require the SDK to be installed in core (it is an optional integration).
    const moduleName = "@anthropic-ai/claude-agent-sdk";
    const mod = (await import(moduleName));
    const rawQuery = mod.query;
    if (typeof rawQuery !== "function") {
        throw new Error('Claude Agent SDK loaded, but missing `query` export (expected "@anthropic-ai/claude-agent-sdk").');
    }
    return { query: coerceClaudeAgentSdkQuery(rawQuery) };
}
