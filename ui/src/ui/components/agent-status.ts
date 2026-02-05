import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

export type AgentStatusType = "idle" | "working" | "thinking" | "streaming";

/**
 * Animated agent status indicator showing:
 * - Current status (idle/working/thinking/streaming)
 * - Token count for the session
 * - Current model being used
 *
 * Features pulsing animations and "alive" feel.
 */
@customElement("agent-status")
export class AgentStatus extends LitElement {
  @property({ type: String }) status: AgentStatusType = "idle";
  @property({ type: Number }) tokens = 0;
  @property({ type: Number }) maxTokens = 0;
  @property({ type: String }) model = "";
  @property({ type: Boolean }) connected = false;
  @property({ type: String }) assistantName = "Agent";

  static styles = css`
    :host {
      display: block;
      font-family: var(--font-body, system-ui, sans-serif);
    }

    .agent-status {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: var(--card, #181b22);
      border: 1px solid var(--border, #27272a);
      border-radius: var(--radius-lg, 12px);
      transition: all 0.3s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
    }

    .agent-status:hover {
      border-color: var(--border-hover, #52525b);
      box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.25));
    }

    /* Avatar / Pulse Indicator */
    .agent-avatar {
      position: relative;
      width: 40px;
      height: 40px;
      flex-shrink: 0;
    }

    .agent-avatar__core {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-elevated, #1a1d25);
      border: 2px solid var(--border, #27272a);
      border-radius: 50%;
      transition: all 0.3s ease;
      z-index: 2;
    }

    .agent-avatar__icon {
      width: 20px;
      height: 20px;
      color: var(--muted, #71717a);
      transition: all 0.3s ease;
    }

    .agent-avatar__icon svg {
      width: 100%;
      height: 100%;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Status-based styling */
    .agent-status[data-status="idle"] .agent-avatar__core {
      border-color: var(--ok, #22c55e);
    }

    .agent-status[data-status="idle"] .agent-avatar__icon {
      color: var(--ok, #22c55e);
    }

    .agent-status[data-status="working"] .agent-avatar__core,
    .agent-status[data-status="thinking"] .agent-avatar__core,
    .agent-status[data-status="streaming"] .agent-avatar__core {
      border-color: var(--accent, #ff5c5c);
      animation: core-pulse 2s ease-in-out infinite;
    }

    .agent-status[data-status="working"] .agent-avatar__icon,
    .agent-status[data-status="thinking"] .agent-avatar__icon,
    .agent-status[data-status="streaming"] .agent-avatar__icon {
      color: var(--accent, #ff5c5c);
      animation: icon-spin 3s linear infinite;
    }

    /* Pulse rings */
    .agent-avatar__pulse {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      opacity: 0;
      pointer-events: none;
    }

    .agent-status[data-status="working"] .agent-avatar__pulse,
    .agent-status[data-status="thinking"] .agent-avatar__pulse,
    .agent-status[data-status="streaming"] .agent-avatar__pulse {
      animation: pulse-ring 2s ease-out infinite;
    }

    .agent-avatar__pulse::before,
    .agent-avatar__pulse::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid var(--accent, #ff5c5c);
      opacity: 0.6;
    }

    .agent-avatar__pulse::after {
      animation-delay: 0.5s;
    }

    /* Secondary pulse ring */
    .agent-avatar__pulse--secondary {
      position: absolute;
      inset: -8px;
      border-radius: 50%;
      border: 1px solid var(--accent, #ff5c5c);
      opacity: 0;
      pointer-events: none;
    }

    .agent-status[data-status="working"] .agent-avatar__pulse--secondary,
    .agent-status[data-status="thinking"] .agent-avatar__pulse--secondary,
    .agent-status[data-status="streaming"] .agent-avatar__pulse--secondary {
      animation: pulse-ring-outer 2.5s ease-out infinite;
      animation-delay: 0.3s;
    }

    /* Info section */
    .agent-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }

    .agent-info__row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .agent-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-strong, #fafafa);
      letter-spacing: -0.01em;
    }

    .agent-status-text {
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 2px 6px;
      border-radius: var(--radius-sm, 6px);
      background: var(--bg-muted, #262a35);
      color: var(--muted, #71717a);
      transition: all 0.3s ease;
    }

    .agent-status[data-status="idle"] .agent-status-text {
      background: var(--ok-subtle, rgba(34, 197, 94, 0.12));
      color: var(--ok, #22c55e);
    }

    .agent-status[data-status="working"] .agent-status-text,
    .agent-status[data-status="thinking"] .agent-status-text,
    .agent-status[data-status="streaming"] .agent-status-text {
      background: var(--accent-subtle, rgba(255, 92, 92, 0.15));
      color: var(--accent, #ff5c5c);
      animation: text-pulse 1.5s ease-in-out infinite;
    }

    /* Model info */
    .agent-model {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--muted, #71717a);
    }

    .agent-model__icon {
      width: 12px;
      height: 12px;
      color: var(--accent-2, #14b8a6);
    }

    .agent-model__icon svg {
      width: 100%;
      height: 100%;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .agent-model__name {
      font-weight: 500;
      color: var(--text, #e4e4e7);
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Token bar */
    .agent-tokens {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }

    .token-bar {
      position: relative;
      flex: 1;
      height: 4px;
      background: var(--bg-muted, #262a35);
      border-radius: var(--radius-full, 9999px);
      overflow: hidden;
    }

    .token-bar__fill {
      position: absolute;
      inset: 0;
      width: var(--fill-percent, 0%);
      background: linear-gradient(90deg, var(--accent-2, #14b8a6), var(--ok, #22c55e));
      border-radius: var(--radius-full, 9999px);
      transition: width 0.5s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
    }

    .agent-status[data-status="working"] .token-bar__fill,
    .agent-status[data-status="thinking"] .token-bar__fill,
    .agent-status[data-status="streaming"] .token-bar__fill {
      background: linear-gradient(90deg, var(--accent, #ff5c5c), var(--warn, #f59e0b));
      animation: shimmer-bar 1.5s linear infinite;
      background-size: 200% 100%;
    }

    .token-count {
      font-family: var(--mono, monospace);
      font-size: 11px;
      font-weight: 500;
      color: var(--muted, #71717a);
      white-space: nowrap;
    }

    .token-count__value {
      color: var(--text, #e4e4e7);
    }

    /* Disconnected state */
    .agent-status[data-connected="false"] {
      opacity: 0.6;
    }

    .agent-status[data-connected="false"] .agent-avatar__core {
      border-color: var(--muted-strong, #52525b);
    }

    .agent-status[data-connected="false"] .agent-avatar__icon {
      color: var(--muted-strong, #52525b);
    }

    /* Animations */
    @keyframes core-pulse {
      0%,
      100% {
        box-shadow: 0 0 0 0 var(--accent-glow, rgba(255, 92, 92, 0.25));
      }
      50% {
        box-shadow: 0 0 15px 3px var(--accent-glow, rgba(255, 92, 92, 0.35));
      }
    }

    @keyframes pulse-ring {
      0% {
        transform: scale(1);
        opacity: 0.6;
      }
      100% {
        transform: scale(1.6);
        opacity: 0;
      }
    }

    @keyframes pulse-ring-outer {
      0% {
        transform: scale(1);
        opacity: 0.4;
      }
      100% {
        transform: scale(2);
        opacity: 0;
      }
    }

    @keyframes icon-spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes text-pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }

    @keyframes shimmer-bar {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }

    /* Compact mode */
    .agent-status--compact {
      padding: 8px 12px;
      gap: 10px;
    }

    .agent-status--compact .agent-avatar {
      width: 32px;
      height: 32px;
    }

    .agent-status--compact .agent-avatar__icon {
      width: 16px;
      height: 16px;
    }

    /* Responsive */
    @media (max-width: 600px) {
      .agent-model__name {
        max-width: 120px;
      }
    }
  `;

  private formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}k`;
    }
    return num.toString();
  }

  private getStatusLabel(): string {
    switch (this.status) {
      case "working":
        return "Working";
      case "thinking":
        return "Thinking";
      case "streaming":
        return "Responding";
      case "idle":
      default:
        return "Ready";
    }
  }

  private get fillPercent(): number {
    if (this.maxTokens <= 0) return 0;
    return Math.min(100, Math.round((this.tokens / this.maxTokens) * 100));
  }

  render() {
    const formattedTokens = this.formatNumber(this.tokens);
    const formattedMax = this.maxTokens > 0 ? this.formatNumber(this.maxTokens) : "∞";

    return html`
      <div
        class="agent-status"
        data-status=${this.status}
        data-connected=${this.connected}
        role="status"
        aria-live="polite"
        aria-label="Agent ${this.getStatusLabel()}, ${formattedTokens} tokens used"
      >
        <div class="agent-avatar">
          <div class="agent-avatar__pulse"></div>
          <div class="agent-avatar__pulse--secondary"></div>
          <div class="agent-avatar__core">
            <div class="agent-avatar__icon">
              ${
                this.status === "idle"
                  ? html`
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                    `
                  : html`
                      <svg viewBox="0 0 24 24">
                        <path d="M12 2v4" />
                        <path d="m16.2 7.8 2.9-2.9" />
                        <path d="M18 12h4" />
                        <path d="m16.2 16.2 2.9 2.9" />
                        <path d="M12 18v4" />
                        <path d="m4.9 19.1 2.9-2.9" />
                        <path d="M2 12h4" />
                        <path d="m4.9 4.9 2.9 2.9" />
                      </svg>
                    `
              }
            </div>
          </div>
        </div>

        <div class="agent-info">
          <div class="agent-info__row">
            <span class="agent-name">${this.assistantName}</span>
            <span class="agent-status-text">${this.getStatusLabel()}</span>
          </div>

          ${
            this.model
              ? html`
                <div class="agent-model">
                  <span class="agent-model__icon">
                    <svg viewBox="0 0 24 24">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <rect x="9" y="9" width="6" height="6" />
                      <path d="M15 2v2" />
                      <path d="M15 20v2" />
                      <path d="M9 2v2" />
                      <path d="M9 20v2" />
                      <path d="M2 15h2" />
                      <path d="M2 9h2" />
                      <path d="M20 15h2" />
                      <path d="M20 9h2" />
                    </svg>
                  </span>
                  <span class="agent-model__name" title=${this.model}>
                    ${this.model}
                  </span>
                </div>
              `
              : nothing
          }

          <div class="agent-tokens">
            <div class="token-bar">
              <div
                class="token-bar__fill"
                style="--fill-percent: ${this.fillPercent}%"
              ></div>
            </div>
            <span class="token-count">
              <span class="token-count__value">${formattedTokens}</span>
              /${formattedMax}
            </span>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "agent-status": AgentStatus;
  }
}
