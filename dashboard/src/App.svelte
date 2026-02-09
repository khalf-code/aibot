<script>
  import Sidebar from './lib/Sidebar.svelte';
  import ChatArea from './lib/ChatArea.svelte';

  let currentModel = 'claude-opus-4-5';
  let theme = 'dark';

  let quickActions = [
    { label: 'Search' },
    { label: 'Analyze' },
    { label: 'Summarize' },
    { label: 'Code' },
    { label: 'Browse' }
  ];

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
  }
</script>

<div class="app" data-theme={theme}>
  <Sidebar {theme} on:toggleTheme={toggleTheme} />
  
  <main>
    <ChatArea 
      {currentModel}
      {quickActions}
      on:modelChange={(e) => currentModel = e.detail}
    />
  </main>
</div>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    overflow: hidden;
  }

  .app {
    display: flex;
    height: 100vh;
    width: 100vw;
  }

  /* Dark theme (default) */
  .app[data-theme="dark"] {
    --bg-primary: #0a0a0a;
    --bg-secondary: #0f0f0f;
    --bg-tertiary: #141414;
    --bg-input: #141414;
    --border-color: #252525;
    --border-hover: #353535;
    --text-primary: #e0e0e0;
    --text-secondary: #888;
    --text-muted: #555;
    --text-placeholder: #4a4a4a;
    --accent: #2dd4bf;
    --accent-hover: #5eead4;
  }

  /* Light theme */
  .app[data-theme="light"] {
    --bg-primary: #ffffff;
    --bg-secondary: #f8f9fa;
    --bg-tertiary: #f1f3f4;
    --bg-input: #ffffff;
    --border-color: #e0e0e0;
    --border-hover: #c0c0c0;
    --text-primary: #1a1a1a;
    --text-secondary: #555;
    --text-muted: #888;
    --text-placeholder: #999;
    --accent: #0d9488;
    --accent-hover: #14b8a6;
  }

  :global(body) {
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: var(--bg-primary);
  }
</style>
