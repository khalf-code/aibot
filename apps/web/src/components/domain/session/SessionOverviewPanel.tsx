"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/composed";
import type { Agent } from "@/hooks/queries/useAgents";
import type { GatewaySessionRow } from "@/lib/api/sessions";
import { ChatBackendToggle } from "./ChatBackendToggle";
import { formatRelativeTime, getSessionLabel } from "./session-helpers";
import { Clock, MessagesSquare, Sparkles, FolderOpen } from "lucide-react";

export interface SessionOverviewPanelProps {
  agent: Agent;
  session?: GatewaySessionRow;
  messageCount: number;
  lastActiveAt?: number;
  workspaceDir?: string;
  chatBackend: "gateway" | "vercel-ai";
  onNewSession?: () => void;
  className?: string;
}

export function SessionOverviewPanel({
  agent,
  session,
  messageCount,
  lastActiveAt,
  workspaceDir,
  chatBackend,
  onNewSession,
  className,
}: SessionOverviewPanelProps) {
  const sessionLabel = session ? getSessionLabel(session) : "Current session";

  return (
    <Card className={cn("border-border/60 bg-card/40", className)}>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Session overview
          </p>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <h2 className="text-base font-semibold truncate">{sessionLabel}</h2>
              <p className="text-xs text-muted-foreground truncate">
                {session?.key ?? "Awaiting session key"}
              </p>
            </div>
            <StatusBadge status={agent.status} size="sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <MessagesSquare className="h-3.5 w-3.5" />
              Messages
            </div>
            <p className="text-sm font-semibold">{messageCount}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Last active
            </div>
            <p className="text-sm font-semibold">
              {lastActiveAt ? formatRelativeTime(lastActiveAt) : "Waiting"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            {chatBackend === "gateway" ? "Gateway" : "Vercel AI"}
          </Badge>
          {session?.thinkingLevel && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {session.thinkingLevel}
            </Badge>
          )}
          {session?.verboseLevel && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Verbose {session.verboseLevel}
            </Badge>
          )}
        </div>

        {workspaceDir && (
          <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="truncate">{workspaceDir}</span>
            </div>
          </div>
        )}

        <Separator className="bg-border/60" />

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Session controls
          </div>
          <ChatBackendToggle />
          <div className="grid gap-2">
            <Button
              size="sm"
              onClick={onNewSession}
              disabled={!onNewSession}
            >
              New session
            </Button>
            <Button size="sm" variant="outline" disabled>
              Session settings (soon)
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SessionOverviewPanel;
