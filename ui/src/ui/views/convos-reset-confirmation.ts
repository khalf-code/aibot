import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";

/**
 * Confirmation modal for resetting the Convos integration.
 * Requires the user to type "RESET" before the confirm button becomes active.
 * Optionally allows deleting local XMTP database files.
 */
export function renderConvosResetConfirmation(state: AppViewState) {
  if (!state.convosResetPending) {
    return nothing;
  }

  // Track confirmation input and checkbox via the DOM (no extra state needed)
  let confirmInput: HTMLInputElement | null = null;
  let deleteDbCheckbox: HTMLInputElement | null = null;

  function updateConfirmButton() {
    const btn = confirmInput
      ?.closest(".exec-approval-card")
      ?.querySelector("[data-reset-confirm]") as HTMLButtonElement | null;
    if (btn && confirmInput) {
      btn.disabled = confirmInput.value !== "RESET";
    }
  }

  return html`
    <div class="exec-approval-overlay" role="dialog" aria-modal="true" aria-live="polite">
      <div class="exec-approval-card">
        <div class="exec-approval-header">
          <div>
            <div class="exec-approval-title">Reset Convos integration?</div>
            <div class="exec-approval-sub">This action is destructive and cannot be undone</div>
          </div>
        </div>

        <div style="margin-top: 12px; font-size: 0.9rem; line-height: 1.5; color: var(--text-secondary, #888);">
          <p>This will generate a <strong>new XMTP identity</strong> (new private key) and a new owner conversation invite.</p>
          <p style="margin-top: 8px;">You must <strong>re-join from Convos iOS</strong>. The old identity and conversation will no longer be used.</p>
        </div>

        <div style="margin-top: 16px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
            <input
              type="checkbox"
              @change=${(e: Event) => {
                deleteDbCheckbox = e.target as HTMLInputElement;
              }}
            />
            Also delete local XMTP database files
          </label>
        </div>

        <div style="margin-top: 16px;">
          <label style="display: block; font-size: 0.85rem; margin-bottom: 6px; color: var(--text-secondary, #888);">
            Type <strong>RESET</strong> to confirm
          </label>
          <input
            type="text"
            placeholder="RESET"
            autocomplete="off"
            style="width: 100%; padding: 8px; font-family: monospace; font-size: 0.9rem; border: 1px solid var(--border, #444); border-radius: 4px; background: var(--bg-input, #1a1a1a); color: var(--text-primary, #eee);"
            @input=${(e: Event) => {
              confirmInput = e.target as HTMLInputElement;
              updateConfirmButton();
            }}
          />
        </div>

        <div class="exec-approval-actions">
          <button
            class="btn danger"
            data-reset-confirm
            disabled
            @click=${() => {
              const deleteDb = deleteDbCheckbox?.checked ?? false;
              state.handleConvosResetConfirm(deleteDb);
            }}
          >
            Reset
          </button>
          <button
            class="btn"
            @click=${() => state.handleConvosResetCancel()}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;
}
