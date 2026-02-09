<script>
  import Header from './lib/Header.svelte';
  import StatusCards from './lib/StatusCards.svelte';
  import ActivityFeed from './lib/ActivityFeed.svelte';
  import SessionsList from './lib/SessionsList.svelte';

  // Mock data - will be replaced with real API calls
  let systemStatus = {
    gateway: 'online',
    uptime: '2d 14h 32m',
    model: 'claude-opus-4-5'
  };

  let channels = [
    { name: 'Telegram', status: 'connected', icon: '📱' },
    { name: 'WhatsApp', status: 'disconnected', icon: '💬' },
    { name: 'Discord', status: 'connected', icon: '🎮' },
    { name: 'Web Chat', status: 'connected', icon: '🌐' }
  ];

  let recentActivity = [
    { time: '10:24', action: 'Message received', source: 'Telegram', details: 'Khaled: proceed' },
    { time: '10:20', action: 'Repo cloned', source: 'System', details: 'easyhub fork created' },
    { time: '10:15', action: 'Session started', source: 'Web Chat', details: 'Main session' }
  ];

  let sessions = [
    { id: 'main', label: 'Main Session', status: 'active', channel: 'webchat' },
    { id: 'cron-1', label: 'OpenCode Checker', status: 'idle', channel: 'cron' }
  ];
</script>

<main>
  <Header status={systemStatus} />
  
  <div class="dashboard">
    <section class="channels">
      <h2>📡 Connected Channels</h2>
      <StatusCards {channels} />
    </section>

    <section class="activity">
      <h2>📋 Recent Activity</h2>
      <ActivityFeed activities={recentActivity} />
    </section>

    <section class="sessions">
      <h2>🔄 Active Sessions</h2>
      <SessionsList {sessions} />
    </section>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background: #0f0f0f;
    color: #e0e0e0;
  }

  main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
  }

  .dashboard {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    gap: 24px;
    margin-top: 24px;
  }

  .channels {
    grid-column: 1 / -1;
  }

  section {
    background: #1a1a1a;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #2a2a2a;
  }

  h2 {
    margin: 0 0 16px 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #fff;
  }

  @media (max-width: 768px) {
    .dashboard {
      grid-template-columns: 1fr;
    }
  }
</style>
