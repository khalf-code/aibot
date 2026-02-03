import { html, nothing } from "lit";
import type { WhatsAppStatus } from "../types";
import type { ChannelsProps } from "./channels.types";
import { formatAgo } from "../format";
import { renderChannelConfigSection } from "./channels.config";
import { formatDuration } from "./channels.shared";
import { t } from "../i18n";

export function renderWhatsAppCard(params: {
  props: ChannelsProps;
  whatsapp?: WhatsAppStatus;
  accountCountLabel: unknown;
}) {
  const { props, whatsapp, accountCountLabel } = params;

  return html`
    <div class="card">
      <div class="card-title">${t().ui.views.channels.whatsapp.title}</div>
      <div class="card-sub">${t().ui.views.channels.whatsapp.subtitle}</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">${t().ui.views.channels.configured}</span>
          <span>${whatsapp?.configured ? t().ui.views.channels.yes : t().ui.views.channels.no}</span>
        </div>
        <div>
          <span class="label">${t().ui.views.channels.linked}</span>
          <span>${whatsapp?.linked ? t().ui.views.channels.yes : t().ui.views.channels.no}</span>
        </div>
        <div>
          <span class="label">${t().ui.views.channels.running}</span>
          <span>${whatsapp?.running ? t().ui.views.channels.yes : t().ui.views.channels.no}</span>
        </div>
        <div>
          <span class="label">${t().ui.views.channels.connected}</span>
          <span>${whatsapp?.connected ? t().ui.views.channels.yes : t().ui.views.channels.no}</span>
        </div>
        <div>
          <span class="label">${t().ui.views.channels.lastConnect}</span>
          <span>
            ${whatsapp?.lastConnectedAt ? formatAgo(whatsapp.lastConnectedAt) : t().ui.views.channels.na}
          </span>
        </div>
        <div>
          <span class="label">${t().ui.views.channels.lastMessage}</span>
          <span>
            ${whatsapp?.lastMessageAt ? formatAgo(whatsapp.lastMessageAt) : t().ui.views.channels.na}
          </span>
        </div>
        <div>
          <span class="label">${t().ui.views.channels.authAge}</span>
          <span>
            ${whatsapp?.authAgeMs != null ? formatDuration(whatsapp.authAgeMs) : t().ui.views.channels.na}
          </span>
        </div>
      </div>

      ${whatsapp?.lastError
      ? html`<div class="callout danger" style="margin-top: 12px;">
            ${whatsapp.lastError}
          </div>`
      : nothing
    }

      ${props.whatsappMessage
      ? html`<div class="callout" style="margin-top: 12px;">
            ${props.whatsappMessage}
          </div>`
      : nothing
    }

      ${props.whatsappQrDataUrl
      ? html`<div class="qr-wrap">
            <img src=${props.whatsappQrDataUrl} alt="WhatsApp QR" />
          </div>`
      : nothing
    }

      <div class="row" style="margin-top: 14px; flex-wrap: wrap;">
        <button
          class="btn primary"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppStart(false)}
        >
          ${props.whatsappBusy ? t().ui.views.channels.whatsapp.working : t().ui.views.channels.whatsapp.showQr}
        </button>
        <button
          class="btn"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppStart(true)}
        >
          ${t().ui.views.channels.whatsapp.relink}
        </button>
        <button
          class="btn"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppWait()}
        >
          ${t().ui.views.channels.whatsapp.waitForScan}
        </button>
        <button
          class="btn danger"
          ?disabled=${props.whatsappBusy}
          @click=${() => props.onWhatsAppLogout()}
        >
          ${t().ui.views.channels.whatsapp.logout}
        </button>
        <button class="btn" @click=${() => props.onRefresh(true)}>
          ${t().ui.views.channels.refresh}
        </button>
      </div>

      ${renderChannelConfigSection({ channelId: "whatsapp", props })}
    </div>
  `;
}
