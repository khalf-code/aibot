import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CardSkeleton } from "@/components/composed";
import {
  SessionHeader,
  SessionChat,
  SessionActivityFeed,
  SessionWorkspacePane,
  SessionOverviewPanel,
  type Activity,
} from "@/components/domain/session";
import { useAgent } from "@/hooks/queries/useAgents";
import { useAgentSessions, useChatHistory } from "@/hooks/queries/useSessions";
import { useChatBackend } from "@/hooks/useChatBackend";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import { useVercelSessionStore } from "@/stores/useVercelSessionStore";
import { buildAgentSessionKey, type ChatMessage } from "@/lib/api/sessions";
import type { StreamingMessage } from "@/stores/useSessionStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TerminalSquare, Timer } from "lucide-react";
import { formatRelativeTime, getSessionLabel } from "@/components/domain/session/session-helpers";

export const Route = createFileRoute("/agents/$agentId/session/$sessionKey")({
  component: AgentSessionPage,
  validateSearch: (search: Record<string, unknown>): { newSession?: boolean; initialMessage?: string } => {
    const newSession = search.newSession === true || search.newSession === "true";
    const initialMessage = typeof search.initialMessage === "string" ? search.initialMessage : undefined;
    return { newSession: newSession || undefined, initialMessage };
  },
});

// Mock activities for development
const mockActivities: Activity[] = [
  {
    id: "live-1",
    type: "task_live",
    title: "Processing request",
    description: "Analyzing user query...",
    progress: 65,
    timestamp: new Date(Date.now() - 30000).toISOString(),
  },
  {
    id: "1",
    type: "message",
    title: "Response generated",
    description: "Completed AI response",
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: "2",
    type: "search",
    title: "Web search",
    description: "Searched for relevant information",
    timestamp: new Date(Date.now() - 180000).toISOString(),
  },
  {
    id: "3",
    type: "code",
    title: "Code execution",
    description: "Ran analysis script",
    timestamp: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: "4",
    type: "task_complete",
    title: "Task completed",
    description: "Finished data processing",
    timestamp: new Date(Date.now() - 600000).toISOString(),
  },
];

function getLatestMessageTimestamp(messages: ReadonlyArray<ChatMessage>): number | undefined {
  return messages.reduce<number | undefined>((latest, message) => {
    if (!message.timestamp) {return latest;}
    const parsed = Date.parse(message.timestamp);
    if (Number.isNaN(parsed)) {return latest;}
    if (!latest || parsed > latest) {return parsed;}
    return latest;
  }, undefined);
}

interface SessionSummaryStripProps {
  sessionLabel: string;
  messageCount: number;
  lastActiveAt?: number;
  chatBackend: "gateway" | "vercel-ai";
}

function SessionSummaryStrip({
  sessionLabel,
  messageCount,
  lastActiveAt,
  chatBackend,
}: SessionSummaryStripProps) {
  return (
    <div className="px-4 pb-3 xl:hidden">
      <Card className="border-border/60 bg-card/40">
        <CardContent className="p-3 flex flex-wrap items-center gap-3 text-xs">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Session</p>
            <p className="text-sm font-semibold truncate">{sessionLabel}</p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Timer className="h-3.5 w-3.5" />
            <span>{lastActiveAt ? formatRelativeTime(lastActiveAt) : "Waiting"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <TerminalSquare className="h-3.5 w-3.5" />
            <span>{messageCount} messages</span>
          </div>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            {chatBackend === "gateway" ? "Gateway" : "Vercel AI"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentSessionPage() {
  const { agentId, sessionKey: sessionKeyParam } = Route.useParams();
  const navigate = Route.useNavigate();

  // State
  const [workspacePaneMaximized, setWorkspacePaneMaximized] = React.useState(false);
  const [activities] = React.useState<Activity[]>(mockActivities);

  // Preferences (for backend selection)
  const chatBackend = usePreferencesStore((state) => state.chatBackend);
  const vercelStore = useVercelSessionStore();

  // Queries
  const { data: agent, isLoading: agentLoading, error: agentError } = useAgent(agentId);
  const { data: sessions, defaults } = useAgentSessions(agentId);

  // Determine active session key
  const sessionKey = React.useMemo(() => {
    // If sessionKey param is "current" or empty, use the first session or build default
    if (sessionKeyParam === "current" || !sessionKeyParam) {
      if (sessions && sessions.length > 0) {
        return sessions[0].key;
      }
      return buildAgentSessionKey(agentId, defaults?.mainKey ?? "main");
    }
    return sessionKeyParam;
  }, [sessionKeyParam, sessions, agentId, defaults?.mainKey]);

  // Load chat history for the active session (gateway only)
  const { data: chatHistory, isLoading: chatLoading } = useChatHistory(sessionKey);

  // Use unified chat backend hook
  const { streamingMessage, handleSend, handleStop, isStreaming } = useChatBackend(sessionKey, agent ?? undefined);

  // Get messages based on active backend
  // Type assertion: VercelChatMessage is structurally compatible with ChatMessage for display
  const messages = React.useMemo((): ChatMessage[] => {
    if (chatBackend === "vercel-ai") {
      // Use Vercel AI local history (cast for type compatibility)
      return vercelStore.getHistory(sessionKey) as ChatMessage[];
    }
    // Use gateway history from server
    return chatHistory?.messages ?? [];
  }, [chatBackend, sessionKey, chatHistory?.messages, vercelStore]);

  const selectedSession = React.useMemo(
    () => sessions?.find((session) => session.key === sessionKey),
    [sessions, sessionKey]
  );
  const messageCount = selectedSession?.messageCount ?? messages.length;
  const derivedLastActive = getLatestMessageTimestamp(messages);
  const lastActiveAt = selectedSession?.lastMessageAt ?? derivedLastActive;

  // Handle session change (switching to an existing session)
  const handleSessionChange = React.useCallback(
    (newSessionKey: string) => {
      navigate({
        to: "/agents/$agentId/session/$sessionKey",
        params: { agentId, sessionKey: newSessionKey },
        search: { newSession: false },
      });
    },
    [navigate, agentId]
  );

  // Handle new session (creating a fresh session)
  const handleNewSession = React.useCallback(() => {
    const newKey = buildAgentSessionKey(agentId, `session-${Date.now()}`);
    navigate({
      to: "/agents/$agentId/session/$sessionKey",
      params: { agentId, sessionKey: newKey },
      search: { newSession: true },
    });
  }, [navigate, agentId]);

  // Loading state
  if (agentLoading) {
    return (
      <div className="min-h-full bg-background text-foreground p-6">
        <CardSkeleton />
      </div>
    );
  }

  // Error state
  if (agentError || !agent) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <Card className="border-destructive/50 bg-destructive/10 max-w-2xl mx-auto">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold text-destructive mb-2">
              Agent Not Found
            </h2>
            <p className="text-muted-foreground mb-4">
              The agent you're looking for doesn't exist or has been removed.
            </p>
            <Button variant="outline" onClick={() => navigate({ to: "/agents" })}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Agents
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground overflow-hidden">
      {/* Session Header - Always visible, shrink-0 prevents it from shrinking */}
      <SessionHeader
        agent={agent}
        sessions={sessions ?? []}
        selectedSessionKey={sessionKey}
        onSessionChange={handleSessionChange}
        onNewSession={handleNewSession}
      />

      <SessionSummaryStrip
        sessionLabel={selectedSession ? getSessionLabel(selectedSession) : "Current session"}
        messageCount={messageCount}
        lastActiveAt={lastActiveAt}
        chatBackend={chatBackend}
      />

      {/* Main content area - flex-1 with min-h-0 allows proper height distribution */}
      <div
        className={cn(
          "flex-1 min-h-0 grid",
          workspacePaneMaximized
            ? "grid-cols-1"
            : "grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_360px]"
        )}
      >
        <aside
          className={cn(
            "hidden xl:flex flex-col border-r border-border/50 bg-muted/20 p-4",
            workspacePaneMaximized && "hidden"
          )}
        >
          <SessionOverviewPanel
            agent={agent}
            session={selectedSession}
            messageCount={messageCount}
            lastActiveAt={lastActiveAt}
            workspaceDir={`~/.clawdbrain/agents/${agentId}/workspace`}
            chatBackend={chatBackend}
            onNewSession={handleNewSession}
          />
        </aside>

        {/* Chat section (center) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "min-w-0 min-h-0 flex flex-col",
            workspacePaneMaximized && "hidden"
          )}
        >
          <SessionChat
            messages={messages}
            streamingMessage={streamingMessage as StreamingMessage | null}
            agentName={agent.name}
            agentStatus={agent.status === "online" ? "active" : "ready"}
            isLoading={chatBackend === "gateway" ? chatLoading : false}
            onSend={handleSend}
            onStop={handleStop}
            disabled={isStreaming}
          />
        </motion.div>

        {/* Right sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className={cn(
            "min-h-0 flex flex-col border-l border-border/50 bg-card/30",
            workspacePaneMaximized && "border-l-0"
          )}
        >
          <Tabs defaultValue="activity" className="flex-1 min-h-0">
            <div className="px-3 pt-3">
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="workspace">Workspace</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="activity" className="flex-1 min-h-0 px-3 pb-3">
              <div className="h-full border border-border/50 rounded-xl overflow-hidden bg-card/40">
                <div className="px-4 py-3 border-b border-border/50">
                  <h3 className="text-sm font-medium">Activity</h3>
                </div>
                <SessionActivityFeed activities={activities} maxItems={12} />
              </div>
            </TabsContent>

            <TabsContent value="workspace" className="flex-1 min-h-0 px-3 pb-3">
              <SessionWorkspacePane
                isMaximized={workspacePaneMaximized}
                onToggleMaximize={() => setWorkspacePaneMaximized((v) => !v)}
                sessionKey={sessionKey}
                workspaceDir={`~/.clawdbrain/agents/${agentId}/workspace`}
                agentId={agentId}
                className="h-full"
              />
            </TabsContent>
          </Tabs>
        </motion.aside>
      </div>
    </div>
  );
}

export default AgentSessionPage;
