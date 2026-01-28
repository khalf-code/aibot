import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  getLocale,
  setLocale,
  subscribeLocale,
  getAvailableLocales,
  type Locale,
} from "../../i18n/index.js";

/**
 * Language switcher component for Clawdbot Control UI
 *
 * Usage: <language-switcher></language-switcher>
 */
@customElement("language-switcher")
export class LanguageSwitcher extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
    }

    .switcher {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      border-radius: 8px;
      background: var(--md-sys-color-surface-container, #1e1e1e);
      border: 1px solid var(--md-sys-color-outline-variant, #444);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .switcher:hover {
      background: var(--md-sys-color-surface-container-high, #2a2a2a);
      border-color: var(--md-sys-color-outline, #666);
    }

    .globe {
      width: 16px;
      height: 16px;
      opacity: 0.8;
    }

    select {
      background: transparent;
      border: none;
      color: var(--md-sys-color-on-surface, #e0e0e0);
      font-size: 14px;
      font-family: inherit;
      cursor: pointer;
      outline: none;
      padding: 0;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
    }

    select option {
      background: var(--md-sys-color-surface-container, #1e1e1e);
      color: var(--md-sys-color-on-surface, #e0e0e0);
    }

    .arrow {
      width: 12px;
      height: 12px;
      opacity: 0.6;
      margin-left: 2px;
    }
  `;

  @state()
  private locale: Locale = getLocale();

  private unsubscribe?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribe = subscribeLocale(() => {
      this.locale = getLocale();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
  }

  private handleChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    setLocale(select.value as Locale);
  }

  override render() {
    const locales = getAvailableLocales();

    return html`
      <div class="switcher">
        <svg class="globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <select .value=${this.locale} @change=${this.handleChange}>
          ${locales.map(
            (l) => html`
              <option value=${l.code} ?selected=${l.code === this.locale}>
                ${l.name}
              </option>
            `,
          )}
        </select>
        <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "language-switcher": LanguageSwitcher;
  }
}
