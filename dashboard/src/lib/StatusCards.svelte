<script>
  export let channels = [];
</script>

<div class="cards">
  {#each channels as channel}
    <div class="card {channel.status}">
      <span class="icon">{channel.icon}</span>
      <div class="info">
        <span class="name">{channel.name}</span>
        <span class="status">{channel.status}</span>
      </div>
      <span class="indicator"></span>
    </div>
  {/each}
</div>

<style>
  .cards {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: #242424;
    border-radius: 10px;
    border: 1px solid #333;
    min-width: 180px;
    transition: transform 0.2s, border-color 0.2s;
  }

  .card:hover {
    transform: translateY(-2px);
  }

  .card.connected {
    border-color: #22c55e33;
  }

  .card.disconnected {
    border-color: #ef444433;
    opacity: 0.7;
  }

  .icon {
    font-size: 1.5rem;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .name {
    font-weight: 600;
    color: #fff;
  }

  .status {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .connected .status {
    color: #22c55e;
  }

  .disconnected .status {
    color: #ef4444;
  }

  .indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-left: auto;
  }

  .connected .indicator {
    background: #22c55e;
    box-shadow: 0 0 8px #22c55e;
  }

  .disconnected .indicator {
    background: #ef4444;
  }
</style>
