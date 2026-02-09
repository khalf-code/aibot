<script>
  import { createEventDispatcher } from 'svelte';
  
  export let currentModel = 'claude-opus-4-5';
  export let quickActions = [];

  const dispatch = createEventDispatcher();

  let inputText = '';
  let showModelDropdown = false;

  const models = [
    { id: 'claude-opus-4-5', name: 'Claude Opus', provider: 'Anthropic' },
    { id: 'claude-sonnet-4', name: 'Claude Sonnet', provider: 'Anthropic' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
    { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google' }
  ];

  function selectModel(modelId) {
    dispatch('modelChange', modelId);
    showModelDropdown = false;
  }

  function handleSubmit() {
    if (inputText.trim()) {
      console.log('Send:', inputText);
      inputText = '';
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  $: currentModelDisplay = models.find(m => m.id === currentModel)?.name || currentModel;
</script>

<div class="chat-area">
  <div class="center-content">
    <!-- Title -->
    <h1 class="title">EasyHub</h1>

    <!-- Chat Input Box -->
    <div class="input-container">
      <div class="input-box">
        <textarea 
          bind:value={inputText}
          on:keydown={handleKeydown}
          placeholder="Ask anything. Type @ for tools and / for commands."
          rows="1"
        ></textarea>

        <div class="input-actions">
          <!-- Model Selector -->
          <div class="model-selector">
            <button 
              class="model-btn"
              on:click={() => showModelDropdown = !showModelDropdown}
            >
              {currentModelDisplay}
              <span class="chevron">▼</span>
            </button>
            
            {#if showModelDropdown}
              <div class="model-dropdown">
                {#each models as model}
                  <button 
                    class="model-option"
                    class:active={currentModel === model.id}
                    on:click={() => selectModel(model.id)}
                  >
                    <span class="model-name">{model.name}</span>
                    <span class="model-provider">{model.provider}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Send -->
          <button 
            class="send-btn" 
            on:click={handleSubmit}
            disabled={!inputText.trim()}
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      {#each quickActions as action}
        <button class="action-chip">
          {action.label}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .chat-area {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }

  .center-content {
    width: 100%;
    max-width: 680px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  .title {
    font-size: 3rem;
    font-weight: 300;
    color: var(--text-secondary);
    margin: 0;
    letter-spacing: -1px;
  }

  .input-container {
    width: 100%;
  }

  .input-box {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    padding: 14px 18px;
    background: var(--bg-input);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    transition: border-color 0.2s;
  }

  .input-box:focus-within {
    border-color: var(--border-hover);
  }

  textarea {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 1rem;
    font-family: inherit;
    resize: none;
    outline: none;
    line-height: 1.5;
    max-height: 200px;
  }

  textarea::placeholder {
    color: var(--text-placeholder);
  }

  .input-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .model-selector {
    position: relative;
  }

  .model-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    font-size: 0.85rem;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .model-btn:hover {
    border-color: var(--border-hover);
    color: var(--text-primary);
  }

  .chevron {
    font-size: 0.55rem;
    opacity: 0.6;
  }

  .model-dropdown {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 8px;
    min-width: 180px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 100;
  }

  .model-option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.15s;
  }

  .model-option:hover {
    background: var(--bg-tertiary);
  }

  .model-option.active {
    background: #1e3a5f;
    color: #60a5fa;
  }

  .model-name {
    font-size: 0.9rem;
    font-weight: 500;
  }

  .model-provider {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .model-option.active .model-provider {
    color: #60a5fa88;
  }

  .send-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: var(--accent);
    color: #000;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .send-btn:disabled {
    background: var(--bg-tertiary);
    color: var(--text-muted);
    cursor: not-allowed;
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
  }

  .action-chip {
    padding: 10px 20px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 20px;
    color: var(--text-secondary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-chip:hover {
    background: var(--bg-tertiary);
    border-color: var(--border-hover);
    color: var(--text-primary);
  }
</style>
