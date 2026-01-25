import { html, nothing } from "lit";

import { formatEventPayload } from "../presenter";
import type { EventLogEntry } from "../app-events";

export type DebugProps = {
  loading: boolean;
  status: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  models: unknown[];
  heartbeat: unknown;
  eventLog: EventLogEntry[];
  callMethod: string;
  callParams: string;
  callResult: string | null;
  callError: string | null;
  onCallMethodChange: (next: string) => void;
  onCallParamsChange: (next: string) => void;
  onRefresh: () => void;
  onCall: () => void;
};

export function renderDebug(props: DebugProps) {
  return html`
    <section class="debug-grid">
      <!-- Left: Snapshots -->
      <div class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">Snapshots</div>
            <div class="card-sub">Status, health, and heartbeat data.</div>
          </div>
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div class="stack" style="margin-top: 12px;">
          <div>
            <div class="muted">Status</div>
            <pre class="code-block">${JSON.stringify(props.status ?? {}, null, 2)}</pre>
          </div>
          <div>
            <div class="muted">Health</div>
            <pre class="code-block">${JSON.stringify(props.health ?? {}, null, 2)}</pre>
          </div>
          <div>
            <div class="muted">Last heartbeat</div>
            <pre class="code-block">${JSON.stringify(props.heartbeat ?? {}, null, 2)}</pre>
          </div>
        </div>
      </div>

      <!-- Right: RPC + Models stacked -->
      <div class="debug-right-stack">
        <div class="card">
          <div class="card-title">Manual RPC</div>
          <div class="card-sub">Send a raw gateway method with JSON params.</div>
          <div class="rpc-form">
            <div class="rpc-input-row">
              <label class="field" style="flex: 1;">
                <span>Method</span>
                <input
                  .value=${props.callMethod}
                  @input=${(e: Event) =>
                    props.onCallMethodChange((e.target as HTMLInputElement).value)}
                  placeholder="system-presence"
                />
              </label>
              <button class="btn primary" @click=${props.onCall}>Call</button>
            </div>
            <label class="field">
              <span>Params (JSON)</span>
              <textarea
                class="rpc-params"
                .value=${props.callParams}
                @input=${(e: Event) =>
                  props.onCallParamsChange((e.target as HTMLTextAreaElement).value)}
                rows="3"
                placeholder="{}"
              ></textarea>
            </label>
          </div>
          ${props.callError
            ? html`<div class="callout danger" style="margin-top: 8px;">
                ${props.callError}
              </div>`
            : nothing}
          ${props.callResult
            ? html`<pre class="code-block" style="margin-top: 8px; max-height: 120px;">${props.callResult}</pre>`
            : nothing}
        </div>

        <div class="card debug-models-card">
          <div class="card-title">Models</div>
          <div class="card-sub">Catalog from models.list.</div>
          <pre class="code-block">${JSON.stringify(props.models ?? [], null, 2)}</pre>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Event Log</div>
      <div class="card-sub">Latest gateway events.</div>
      ${props.eventLog.length === 0
        ? html`<div class="muted" style="margin-top: 12px;">No events yet.</div>`
        : html`
            <div class="event-log" style="margin-top: 12px;">
              ${props.eventLog.map(
                (evt) => html`
                  <div class="event-log-item">
                    <div class="event-log-header">
                      <span class="event-log-name">${evt.event}</span>
                      <span class="event-log-time">${new Date(evt.ts).toLocaleTimeString()}</span>
                    </div>
                    <pre class="code-block event-log-payload">${formatEventPayload(evt.payload)}</pre>
                  </div>
                `,
              )}
            </div>
          `}
    </section>
  `;
}
