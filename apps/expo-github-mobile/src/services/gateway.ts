export type GatewayFrame =
  | { type: 'hello-ok'; protocol: number; server: { version: string; host?: string }; features?: { methods: string[]; events: string[] } }
  | { type: 'res'; id: string; ok: boolean; payload?: unknown; error?: { code: string; message: string } }
  | { type: 'event'; event: string; payload?: unknown; seq?: number }

export type AgentRequestParams = {
  message: string
  agentId?: string
  sessionId?: string
  sessionKey?: string
  thinking?: string
  timeout?: number
  idempotencyKey: string
  repoContext?: {
    owner: string
    name: string
    branch: string
  }
}

export type AgentEventPayload = {
  runId: string
  seq: number
  stream: string
  ts: number
  data: Record<string, unknown>
}

export class GatewayClient {
  private ws: WebSocket | null = null
  private pending = new Map<string, {
    resolve: (value: unknown) => void
    reject: (err: Error) => void
  }>()
  private eventHandlers = new Map<string, Set<(payload: unknown) => void>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private messageQueue: string[] = []

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)
        this.ws.onopen = () => {
          console.log('[Gateway] Connected')
          // Send queued messages
          for (const msg of this.messageQueue) {
            this.ws?.send(msg)
          }
          this.messageQueue = []
          resolve()
        }
        this.ws.onmessage = (event) => this.handleMessage(event.data)
        this.ws.onclose = (event) => {
          console.log('[Gateway] Disconnected', event.code, event.reason)
          this.scheduleReconnect()
        }
        this.ws.onerror = (error) => {
          console.error('[Gateway] Error', error)
          reject(error)
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      console.log('[Gateway] Reconnecting...')
      this.reconnectTimer = null
      this.connect().catch((e) => {
        console.error('[Gateway] Reconnect failed', e)
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
      })
    }, this.reconnectDelay)
  }

  private handleMessage(data: string) {
    try {
      const frame: GatewayFrame = JSON.parse(data)

      if (frame.type === 'res') {
        const pending = this.pending.get(frame.id)
        if (pending) {
          this.pending.delete(frame.id)
          if (frame.ok) {
            pending.resolve(frame.payload)
          } else {
            pending.reject(new Error(frame.error?.message || 'Request failed'))
          }
        }
      } else if (frame.type === 'event') {
        const handlers = this.eventHandlers.get(frame.event)
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(frame.payload)
            } catch (e) {
              console.error('[Gateway] Event handler error', e)
            }
          }
        }
      }
    } catch (e) {
      console.error('[Gateway] Failed to parse message', e)
    }
  }

  private send(frame: Record<string, unknown>): Promise<unknown> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const message = JSON.stringify({ ...frame, id })

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(message)
      } else {
        this.messageQueue.push(message)
      }
    })
  }

  async call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.send({ type: 'req', method, params })
  }

  async startAgent(params: AgentRequestParams): Promise<{ status: string; runId: string }> {
    const result = await this.call('agent', params)
    return result as { status: string; runId: string }
  }

  onEvent(event: string, handler: (payload: unknown) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
    return () => {
      this.eventHandlers.get(event)?.delete(handler)
    }
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
