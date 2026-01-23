import { useEffect, useState, useRef, useCallback } from 'react'
import { GatewayClient, type AgentEventPayload } from '../services/gateway'
import { useSettings } from './useSettings'

export type ToolCallEvent = {
  toolCallId: string
  name: string
  phase: 'start' | 'update' | 'end'
  args?: Record<string, unknown>
  partialResult?: string
  result?: unknown
  isError?: boolean
}

export type AssistantEvent = {
  delta?: string
  thinking?: string
}

export type GatewayState = {
  connected: boolean
  connecting: boolean
  error: string | null
}

export const useGateway = () => {
  const { settings, loading: settingsLoading } = useSettings()
  const clientRef = useRef<GatewayClient | null>(null)
  const [state, setState] = useState<GatewayState>({
    connected: false,
    connecting: false,
    error: null,
  })

  const toolCallHandlersRef = useRef<Set<(event: ToolCallEvent) => void>>(new Set())
  const assistantHandlersRef = useRef<Set<(event: AssistantEvent) => void>>(new Set())
  const lifecycleHandlersRef = useRef<Set<(event: Record<string, unknown>) => void>>(new Set())

  // Connect to gateway
  useEffect(() => {
    if (settingsLoading) return
    if (!settings.gatewayUrl) return

    const client = new GatewayClient(settings.gatewayUrl)
    clientRef.current = client

    setState((s) => ({ ...s, connecting: true, error: null }))

    // Handle agent events
    const unsubscribe = client.onEvent('agent', (payload) => {
      const evt = payload as AgentEventPayload

      switch (evt.stream) {
        case 'tool': {
          const data = evt.data as ToolCallEvent
          for (const handler of toolCallHandlersRef.current) {
            handler(data)
          }
          break
        }
        case 'assistant': {
          const data = evt.data as AssistantEvent
          for (const handler of assistantHandlersRef.current) {
            handler(data)
          }
          break
        }
        case 'lifecycle': {
          for (const handler of lifecycleHandlersRef.current) {
            handler(evt.data)
          }
          break
        }
      }
    })

    client.connect()
      .then(() => {
        setState({ connected: true, connecting: false, error: null })
      })
      .catch((e) => {
        setState({ connected: false, connecting: false, error: e.message })
      })

    return () => {
      unsubscribe()
      client.disconnect()
      clientRef.current = null
      setState({ connected: false, connecting: false, error: null })
    }
  }, [settings.gatewayUrl, settingsLoading])

  const sendMessage = useCallback(async (
    message: string,
    repoContext?: { owner: string; name: string; branch: string }
  ): Promise<{ status: string; runId: string } | null> => {
    const client = clientRef.current
    if (!client?.connected) {
      console.error('[useGateway] Not connected')
      return null
    }

    try {
      const result = await client.startAgent({
        message,
        repoContext,
        idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      })
      return result
    } catch (e) {
      console.error('[useGateway] Failed to send message', e)
      return null
    }
  }, [])

  const onToolCall = useCallback((handler: (event: ToolCallEvent) => void) => {
    toolCallHandlersRef.current.add(handler)
    return () => {
      toolCallHandlersRef.current.delete(handler)
    }
  }, [])

  const onAssistant = useCallback((handler: (event: AssistantEvent) => void) => {
    assistantHandlersRef.current.add(handler)
    return () => {
      assistantHandlersRef.current.delete(handler)
    }
  }, [])

  const onLifecycle = useCallback((handler: (event: Record<string, unknown>) => void) => {
    lifecycleHandlersRef.current.add(handler)
    return () => {
      lifecycleHandlersRef.current.delete(handler)
    }
  }, [])

  return {
    ...state,
    sendMessage,
    onToolCall,
    onAssistant,
    onLifecycle,
  }
}
