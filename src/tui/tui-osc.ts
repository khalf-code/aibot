/**
 * OSC 133 shell integration sequences for semantic terminal prompts.
 *
 * Enables terminal features like:
 * - Jump between prompts (Ctrl+Shift+J/K in Ghostty)
 * - Select entire command output
 * - Better terminal navigation
 *
 * Supported terminals: Ghostty, iTerm2, Kitty, WezTerm
 *
 * @see https://ghostty.org/docs/features/shell-integration
 * @see https://gitlab.freedesktop.org/Per_Bothner/specifications/blob/master/proposals/semantic-prompts.md
 */

/**
 * Check if stdout is a TTY (only emit OSC sequences to actual terminals)
 */
function isTTY(): boolean {
  return Boolean(process.stdout.isTTY);
}

/**
 * OSC 133 sequence emitters for semantic shell integration
 */
export const OSC133 = {
  /**
   * Emit OSC 133;A - Prompt start (editor ready for input)
   * Call when the TUI is idle and ready for user input
   */
  promptStart: (): void => {
    if (isTTY()) {
      process.stdout.write("\x1b]133;A\x07");
    }
  },

  /**
   * Emit OSC 133;C - Command start (user submitted, execution begins)
   * Call right before processing user input (message/command/bang)
   */
  commandStart: (): void => {
    if (isTTY()) {
      process.stdout.write("\x1b]133;C\x07");
    }
  },

  /**
   * Emit OSC 133;D - Command end (output complete)
   * Call when agent response is finalized and output is complete
   */
  commandEnd: (): void => {
    if (isTTY()) {
      process.stdout.write("\x1b]133;D\x07");
    }
  },
};
