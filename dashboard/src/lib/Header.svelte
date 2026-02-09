<script>
  export let status;
</script>

<header>
  <div class="logo">
    <span class="icon">🦅</span>
    <h1>EasyHub</h1>
    <span class="subtitle">Command Center</span>
  </div>
  
  <div class="status-bar">
    <div class="status-item">
      <span class="indicator {status.gateway}"></span>
      <span>Gateway: {status.gateway}</span>
    </div>
    <div class="status-item">
      <span class="label">Uptime:</span>
      <span>{status.uptime}</span>
    </div>
    <div class="status-item">
      <span class="label">Model:</span>
      <span class="model">{status.model}</span>
    </div>
  </div>
</header>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background: #1a1a1a;
    border-radius: 12px;
    border: 1px solid #2a2a2a;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .icon {
    font-size: 2rem;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    color: #666;
    font-size: 0.9rem;
  }

  .status-bar {
    display: flex;
    gap: 24px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
  }

  .indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .indicator.online {
    background: #22c55e;
    box-shadow: 0 0 8px #22c55e;
  }

  .indicator.offline {
    background: #ef4444;
  }

  .label {
    color: #666;
  }

  .model {
    color: #a78bfa;
    font-family: monospace;
  }

  @media (max-width: 768px) {
    header {
      flex-direction: column;
      gap: 16px;
    }

    .status-bar {
      flex-wrap: wrap;
      justify-content: center;
    }
  }
</style>
