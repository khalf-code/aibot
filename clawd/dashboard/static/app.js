/* ===========================================
   LIAM'S DASHBOARD - CLIENT JAVASCRIPT
   Real-time updates, ECharts, keyboard shortcuts
   =========================================== */

// === CONFIGURATION ===
const REFRESH_INTERVAL = 5000; // 5 seconds
const CHART_HISTORY = 60; // 60 data points
const GATEWAY_WS_URL = 'ws://127.0.0.1:18789';
const MAX_ACTIVITY_ITEMS = 50;
const WS_RECONNECT_DELAY = 3000;

// === STATE ===
let currentFilter = 'all';
let cpuChart = null;
let memChart = null;
let energyChart = null;
let gatewayWs = null;
let wsReconnectTimer = null;
let liamStatus = 'idle'; // idle, thinking, executing, error
let activityItems = [];

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    fetchData();
    fetchChartData();
    fetchSkillData();
    setupFilterButtons();
    setupKeyboardShortcuts();
    setupCaptureInput();
    connectActivityStream(); // Connect to gateway WebSocket for live activity

    // Auto-refresh
    setInterval(fetchData, REFRESH_INTERVAL);
    setInterval(fetchChartData, REFRESH_INTERVAL);
    setInterval(fetchSkillData, REFRESH_INTERVAL);
});

// === DATA FETCHING ===
async function fetchData() {
    try {
        const res = await fetch('/api/data');
        const data = await res.json();
        updateDashboard(data);
    } catch (err) {
        console.error('Failed to fetch data:', err);
    }
}

async function fetchChartData() {
    try {
        const res = await fetch(`/api/metrics/recent?limit=${CHART_HISTORY}`);
        const data = await res.json();
        updateCharts(data);
    } catch (err) {
        console.error('Failed to fetch chart data:', err);
    }
}

// === SKILL DATA FETCHING ===
async function fetchSkillData() {
    try {
        // Activity and status data from gateway WebSocket
        // (Skills now have their own dedicated pages)
    } catch (err) {
        console.error('Failed to fetch skill data:', err);
    }
}

// Activity feed functions moved to dedicated pages
// See natural-capture.html, ceramics-intelligence.html for skill-specific UIs

// === DASHBOARD UPDATE ===
function updateDashboard(data) {
    // Timestamp
    const ts = new Date(data.timestamp);
    document.getElementById('timestamp').textContent = ts.toLocaleTimeString();

    // Gateway status
    const statusEl = document.getElementById('gateway-status');
    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('.status-text');
    dot.className = `status-dot ${data.gateway.status}`;
    text.textContent = data.gateway.status.toUpperCase();

    // Metrics
    updateMetric('cpu', data.resources.cpu_percent);
    updateMetric('mem', data.resources.mem_percent);
    updateMetric('disk', data.resources.disk_percent);
    document.getElementById('sessions-value').textContent = data.sessions.length;

    // Sessions table
    updateSessionsTable(data.sessions);

    // Subagents tree
    updateSubagentsTree(data.subagents);

    // Queue table
    updateQueueTable(data.queue);
}

function updateMetric(name, value) {
    const valueEl = document.getElementById(`${name}-value`);
    const barEl = document.getElementById(`${name}-bar`);

    valueEl.textContent = `${value}%`;
    barEl.style.width = `${value}%`;

    // Color coding
    barEl.className = 'metric-fill';
    if (value >= 80) barEl.classList.add('high');
    else if (value >= 50) barEl.classList.add('medium');
    else barEl.classList.add('low');
}

// === SESSIONS TABLE ===
function updateSessionsTable(sessions) {
    const tbody = document.querySelector('#sessions-table tbody');

    if (sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty">No active sessions</td></tr>';
        return;
    }

    tbody.innerHTML = sessions.map(s => `
        <tr>
            <td>${escapeHtml(s.agent)}</td>
            <td>${escapeHtml(s.channel)}</td>
            <td>${escapeHtml(s.updated)}</td>
        </tr>
    `).join('');
}

// === SUBAGENTS TREE ===
function updateSubagentsTree(subagents) {
    const container = document.getElementById('subagents-tree');

    if (subagents.length === 0) {
        container.innerHTML = '<div class="empty">No active subagents</div>';
        return;
    }

    // Build ASCII tree
    const lines = subagents.map((s, i) => {
        const prefix = i === subagents.length - 1 ? '└─' : '├─';
        const statusClass = s.status;
        return `<div class="tree-item ${statusClass}">${prefix} ${escapeHtml(s.label || s.task)} [${s.status}]</div>`;
    });

    container.innerHTML = lines.join('');
}

// === QUEUE TABLE ===
function updateQueueTable(queue) {
    const tbody = document.querySelector('#queue-table tbody');

    // Filter
    const filtered = currentFilter === 'all'
        ? queue
        : queue.filter(q => q.status === currentFilter);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty">No items</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(q => `
        <tr>
            <td>${escapeHtml(q.id)}</td>
            <td>${escapeHtml(q.title)}</td>
            <td><span class="status-pill ${q.status}">${q.status.toUpperCase()}</span></td>
        </tr>
    `).join('');
}

function setupFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            fetchData(); // Refresh to apply filter
        });
    });
}

// === ECHARTS ===
function initCharts() {
    // CPU Chart
    const cpuDom = document.getElementById('cpu-chart');
    cpuChart = echarts.init(cpuDom);
    cpuChart.setOption(getChartOption('CPU USAGE', '#ff4444'));

    // Memory Chart
    const memDom = document.getElementById('mem-chart');
    memChart = echarts.init(memDom);
    memChart.setOption(getChartOption('MEMORY USAGE', '#0088ff'));

    // Energy Chart (EF Coach)
    const energyDom = document.getElementById('energy-chart');
    if (energyDom) {
        energyChart = echarts.init(energyDom);
        energyChart.setOption(getEnergyChartOption());
    }

    // Resize handler
    window.addEventListener('resize', () => {
        cpuChart.resize();
        memChart.resize();
        if (energyChart) energyChart.resize();
    });
}

function getChartOption(title, color) {
    return {
        backgroundColor: 'transparent',
        title: {
            text: title,
            textStyle: { color: '#888888', fontSize: 12, fontWeight: 'normal' },
            left: 0,
            top: 0
        },
        grid: { left: 40, right: 10, top: 30, bottom: 25 },
        xAxis: {
            type: 'time',
            boundaryGap: false,
            axisLine: { lineStyle: { color: '#2a2a2a' } },
            axisLabel: { color: '#666666', fontSize: 10 },
            splitLine: { show: false }
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            axisLine: { lineStyle: { color: '#2a2a2a' } },
            axisLabel: { color: '#666666', fontSize: 10, formatter: '{value}%' },
            splitLine: { lineStyle: { color: '#1a1a1a' } }
        },
        series: [{
            type: 'line',
            smooth: true,
            symbol: 'none',
            lineStyle: { color: color, width: 2 },
            areaStyle: { color: color + '20' },
            data: []
        }]
    };
}

function getEnergyChartOption() {
    return {
        backgroundColor: 'transparent',
        grid: { left: 30, right: 10, top: 10, bottom: 20 },
        xAxis: {
            type: 'category',
            data: [],
            axisLine: { lineStyle: { color: '#2a2a2a' } },
            axisLabel: { show: false },
            splitLine: { show: false }
        },
        yAxis: {
            type: 'value',
            min: 1,
            max: 10,
            axisLine: { show: false },
            axisLabel: { show: false },
            splitLine: { lineStyle: { color: '#1a1a1a' } }
        },
        series: [{
            type: 'bar',
            data: [],
            itemStyle: { color: '#ffaa00' },
            barWidth: '60%'
        }]
    };
}

function updateCharts(data) {
    if (data.length === 0) return;

    const cpuData = data.map(d => [new Date(d.timestamp), d.cpu_percent]);
    const memData = data.map(d => [new Date(d.timestamp), d.mem_percent]);

    cpuChart.setOption({ series: [{ data: cpuData }] });
    memChart.setOption({ series: [{ data: memData }] });
}

// === KEYBOARD SHORTCUTS ===
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch(e.key.toLowerCase()) {
            case 'r':
                fetchData();
                fetchChartData();
                break;
            case '?':
                showShortcuts();
                break;
            case 'escape':
                closeShortcuts();
                break;
        }
    });
}

function showShortcuts() {
    document.getElementById('shortcuts-modal').style.display = 'flex';
}

function closeShortcuts() {
    document.getElementById('shortcuts-modal').style.display = 'none';
}

// === UTILITIES ===
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

// === ACTIVITY STREAM (WebSocket to Gateway) ===
function connectActivityStream() {
    if (gatewayWs && gatewayWs.readyState === WebSocket.OPEN) {
        return; // Already connected
    }

    updateWsStatus('connecting');

    try {
        gatewayWs = new WebSocket(GATEWAY_WS_URL);

        gatewayWs.onopen = () => {
            console.log('[Activity] Connected to gateway WebSocket');
            updateWsStatus('connected');
            if (wsReconnectTimer) {
                clearTimeout(wsReconnectTimer);
                wsReconnectTimer = null;
            }
        };

        gatewayWs.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleGatewayMessage(msg);
            } catch (err) {
                console.warn('[Activity] Failed to parse message:', err);
            }
        };

        gatewayWs.onclose = (event) => {
            console.log('[Activity] WebSocket closed:', event.code, event.reason);
            updateWsStatus('disconnected');
            scheduleReconnect();
        };

        gatewayWs.onerror = (err) => {
            console.error('[Activity] WebSocket error:', err);
            updateWsStatus('error');
        };
    } catch (err) {
        console.error('[Activity] Failed to connect:', err);
        updateWsStatus('error');
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    if (wsReconnectTimer) return;
    wsReconnectTimer = setTimeout(() => {
        wsReconnectTimer = null;
        connectActivityStream();
    }, WS_RECONNECT_DELAY);
}

function updateWsStatus(status) {
    const wsStatusEl = document.getElementById('ws-status');
    if (!wsStatusEl) return;

    const statusMap = {
        'connecting': { text: 'WS: ...', class: 'ws-connecting' },
        'connected': { text: 'WS: OK', class: 'ws-connected' },
        'disconnected': { text: 'WS: OFF', class: 'ws-disconnected' },
        'error': { text: 'WS: ERR', class: 'ws-error' }
    };

    const s = statusMap[status] || statusMap['disconnected'];
    wsStatusEl.textContent = s.text;
    wsStatusEl.className = `ws-status ${s.class}`;
}

function handleGatewayMessage(msg) {
    // Gateway sends messages in format: { type: 'event', event: 'agent', data: {...} }
    if (!msg || !msg.type) return;

    // Handle agent events
    if (msg.type === 'event' && msg.event === 'agent') {
        handleAgentEvent(msg.data);
    }
    // Handle chat events (for seeing message flow)
    else if (msg.type === 'event' && msg.event === 'chat') {
        handleChatEvent(msg.data);
    }
}

function handleAgentEvent(evt) {
    if (!evt) return;

    const { stream, data, ts, runId, sessionKey } = evt;
    const timestamp = ts ? new Date(ts).toLocaleTimeString() : new Date().toLocaleTimeString();

    let eventType = stream;
    let summary = '';
    let statusClass = 'event-info';

    if (stream === 'lifecycle') {
        const phase = data?.phase;
        eventType = phase || 'lifecycle';
        
        if (phase === 'start') {
            summary = 'Starting agent run...';
            updateLiamStatus('thinking');
            statusClass = 'event-start';
        } else if (phase === 'end') {
            summary = 'Agent run completed';
            updateLiamStatus('idle');
            statusClass = 'event-done';
        } else if (phase === 'error') {
            summary = data?.errorMessage || 'Error occurred';
            updateLiamStatus('error');
            statusClass = 'event-error';
        } else {
            summary = phase || 'Unknown phase';
        }
    } else if (stream === 'tool') {
        const toolName = data?.name || data?.tool || 'unknown';
        const phase = data?.phase;
        
        if (phase === 'start' || data?.type === 'call') {
            eventType = 'TOOL';
            // Try to get a useful summary from tool input
            const input = data?.input || data?.args || {};
            if (toolName.toLowerCase().includes('read')) {
                summary = `Reading: ${input.path || input.file || '...'}`;
            } else if (toolName.toLowerCase().includes('shell') || toolName.toLowerCase().includes('bash')) {
                summary = `Running: ${(input.command || '...').slice(0, 50)}`;
            } else if (toolName.toLowerCase().includes('grep') || toolName.toLowerCase().includes('search')) {
                summary = `Searching: ${input.pattern || input.query || '...'}`;
            } else if (toolName.toLowerCase().includes('write') || toolName.toLowerCase().includes('edit')) {
                summary = `Writing: ${input.path || input.file || '...'}`;
            } else {
                summary = `${toolName}`;
            }
            updateLiamStatus('executing');
            statusClass = 'event-tool';
        } else if (phase === 'end' || data?.type === 'result') {
            eventType = 'RESULT';
            const success = data?.success !== false && !data?.error;
            summary = success ? 'Tool completed' : `Error: ${data?.error || 'failed'}`;
            updateLiamStatus('thinking');
            statusClass = success ? 'event-result' : 'event-error';
        }
    } else if (stream === 'assistant') {
        eventType = 'THINKING';
        const textLen = (data?.text || '').length;
        summary = textLen > 0 ? `Generating response (${textLen} chars)...` : 'Thinking...';
        updateLiamStatus('thinking');
        statusClass = 'event-thinking';
    } else if (stream === 'error') {
        eventType = 'ERROR';
        summary = data?.message || data?.reason || 'Unknown error';
        updateLiamStatus('error');
        statusClass = 'event-error';
    }

    // Add to activity feed
    addActivityItem({
        timestamp,
        eventType,
        summary,
        statusClass,
        runId: runId?.slice(0, 8),
        sessionKey: sessionKey?.split(':')[1] || sessionKey?.slice(0, 8)
    });
}

function handleChatEvent(evt) {
    if (!evt) return;

    const { state, sessionKey } = evt;
    const timestamp = new Date().toLocaleTimeString();

    if (state === 'final') {
        addActivityItem({
            timestamp,
            eventType: 'DONE',
            summary: 'Response sent',
            statusClass: 'event-done',
            sessionKey: sessionKey?.split(':')[1] || sessionKey?.slice(0, 8)
        });
        updateLiamStatus('idle');
    }
}

function updateLiamStatus(status) {
    liamStatus = status;
    const dotEl = document.getElementById('liam-status-dot');
    const textEl = document.getElementById('liam-status');
    
    if (!dotEl || !textEl) return;

    const statusMap = {
        'idle': { text: 'IDLE', class: 'status-idle' },
        'thinking': { text: 'THINKING', class: 'status-thinking' },
        'executing': { text: 'EXECUTING', class: 'status-executing' },
        'error': { text: 'ERROR', class: 'status-error' }
    };

    const s = statusMap[status] || statusMap['idle'];
    textEl.textContent = s.text;
    dotEl.className = `activity-status-dot ${s.class}`;
}

function addActivityItem(item) {
    // Add to front of array
    activityItems.unshift(item);
    
    // Keep only last N items
    if (activityItems.length > MAX_ACTIVITY_ITEMS) {
        activityItems = activityItems.slice(0, MAX_ACTIVITY_ITEMS);
    }

    // Render
    renderActivityFeed();
}

function renderActivityFeed() {
    const feedEl = document.getElementById('activity-feed');
    if (!feedEl) return;

    if (activityItems.length === 0) {
        feedEl.innerHTML = '<div class="activity-item empty">Waiting for activity...</div>';
        return;
    }

    feedEl.innerHTML = activityItems.map(item => `
        <div class="activity-item ${item.statusClass}">
            <span class="activity-time">${escapeHtml(item.timestamp)}</span>
            <span class="activity-type">[${escapeHtml(item.eventType)}]</span>
            <span class="activity-summary">${escapeHtml(item.summary)}</span>
            ${item.sessionKey ? `<span class="activity-session">${escapeHtml(item.sessionKey)}</span>` : ''}
        </div>
    `).join('');
}
