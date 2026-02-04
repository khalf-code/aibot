import { html, nothing } from "lit";
import type { HealthData } from "../controllers/health.ts";
import { renderSpinner } from "../app-render.helpers.ts";

export type HealthProps = {
  loading: boolean;
  error: string | null;
  data: HealthData | null;
  channels: Array<{ id: string; status: string }>;
  connected: boolean;
  debugHealth: unknown;
  onRefresh: () => void;
};

function channelStatusColor(status: string): string {
  switch (status) {
    case "connected":
    case "healthy":
    case "ok":
      return "var(--ok)";
    case "degraded":
    case "warning":
      return "var(--warn)";
    case "disconnected":
    case "error":
    case "down":
      return "var(--danger)";
    default:
      return "var(--muted)";
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatHeartbeatAge(ms: number | null): string {
  if (ms === null) {
    return "n/a";
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

export function renderHealth(props: HealthProps) {
  const data = props.data;

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">System Health</div>
          <div class="card-sub">Gateway health snapshot and channel status.</div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      ${props.error ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>` : nothing}

      ${
        props.loading && !data
          ? renderSpinner("Loading health data...")
          : html`
            <div class="grid grid-cols-3" style="margin-top: 16px;">
              <div class="card stat-card">
                <div class="stat-label">Gateway</div>
                <div class="stat-value ${props.connected ? "ok" : ""}">
                  ${props.connected ? "Online" : "Offline"}
                </div>
                ${data ? html`<div class="muted">Probe: ${formatDuration(data.durationMs)}</div>` : nothing}
              </div>
              <div class="card stat-card">
                <div class="stat-label">Sessions</div>
                <div class="stat-value">${data?.sessionCount ?? 0}</div>
                ${data?.sessionPath ? html`<div class="muted" style="word-break: break-all; font-size: 11px;">${data.sessionPath}</div>` : nothing}
              </div>
              <div class="card stat-card">
                <div class="stat-label">Channels</div>
                <div class="stat-value">${data?.channels.length ?? 0}</div>
                <div class="muted">
                  ${data ? `${data.channels.filter((c) => c.linked).length} linked` : ""}
                </div>
              </div>
            </div>
          `
      }
    </section>

    ${
      data && data.agents.length > 0
        ? html`
          <section class="card" style="margin-top: 18px;">
            <div class="card-title">Agents</div>
            <div class="card-sub">Heartbeat and session status per agent.</div>
            <div class="list" style="margin-top: 12px;">
              ${data.agents.map(
                (agent) => html`
                  <div class="list-item">
                    <div class="list-main">
                      <div class="list-title">
                        ${agent.name ?? agent.agentId}
                        ${
                          agent.isDefault
                            ? html`
                                <span class="chip chip-ok" style="margin-left: 6px">default</span>
                              `
                            : nothing
                        }
                      </div>
                      <div class="list-sub">${agent.agentId}</div>
                    </div>
                    <div class="list-meta" style="text-align: right;">
                      <div>
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${agent.heartbeatAlive ? "var(--ok)" : "var(--danger)"}; margin-right: 4px;"></span>
                        ${agent.heartbeatAlive ? "Alive" : "Dead"}
                      </div>
                      <div class="muted">${formatHeartbeatAge(agent.heartbeatAgeMs)}</div>
                      <div class="muted">${agent.sessionCount} sessions</div>
                    </div>
                  </div>
                `,
              )}
            </div>
          </section>
        `
        : nothing
    }

    ${
      props.channels.length > 0
        ? html`
          <section class="card" style="margin-top: 18px;">
            <div class="card-title">Channel Health</div>
            <div class="card-sub">Status of all registered channels.</div>
            <div class="health-channel-matrix" style="margin-top: 12px;">
              ${props.channels.map(
                (ch) => html`
                  <div class="health-channel-cell">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${channelStatusColor(ch.status)}; flex-shrink: 0;"></div>
                    <span>${ch.id}</span>
                    <span class="muted" style="font-size: 11px;">${ch.status}</span>
                  </div>
                `,
              )}
            </div>
          </section>
        `
        : nothing
    }
  `;
}
