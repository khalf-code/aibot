<script>
  export let sessions = [];
</script>

<div class="list">
  {#each sessions as session}
    <div class="session {session.status}">
      <div class="info">
        <span class="label">{session.label}</span>
        <span class="id">{session.id}</span>
      </div>
      <div class="meta">
        <span class="channel">{session.channel}</span>
        <span class="status-badge">{session.status}</span>
      </div>
    </div>
  {/each}
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .session {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    background: #242424;
    border-radius: 8px;
    border: 1px solid #333;
    transition: border-color 0.2s;
  }

  .session.active {
    border-color: #60a5fa44;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label {
    font-weight: 600;
    color: #fff;
  }

  .id {
    font-family: monospace;
    font-size: 0.8rem;
    color: #666;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .channel {
    font-size: 0.8rem;
    color: #888;
  }

  .status-badge {
    font-size: 0.7rem;
    padding: 4px 10px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  .active .status-badge {
    background: #22c55e22;
    color: #22c55e;
  }

  .idle .status-badge {
    background: #666622;
    color: #aaaa44;
  }
</style>
