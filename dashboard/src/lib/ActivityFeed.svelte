<script>
  export let activities = [];
</script>

<div class="feed">
  {#each activities as activity}
    <div class="item">
      <span class="time">{activity.time}</span>
      <div class="content">
        <span class="action">{activity.action}</span>
        <span class="details">{activity.details}</span>
      </div>
      <span class="source">{activity.source}</span>
    </div>
  {/each}
</div>

<style>
  .feed {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: #242424;
    border-radius: 8px;
    border: 1px solid #333;
  }

  .time {
    font-family: monospace;
    font-size: 0.85rem;
    color: #666;
    min-width: 50px;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .action {
    font-weight: 500;
    color: #fff;
  }

  .details {
    font-size: 0.85rem;
    color: #888;
  }

  .source {
    font-size: 0.75rem;
    padding: 4px 8px;
    background: #333;
    border-radius: 4px;
    color: #aaa;
  }
</style>
