import path from "node:path";

export type ProjectConfig = {
  id: string;
  name: string;
  channels?: string[];
  sources?: string[];
  keywords?: string[];
};

export type ProjectContext = {
  projectId: string | undefined;
  projectName: string | undefined;
  source: "channel" | "explicit" | "default" | "none";
};

function normalizeChannelName(name: string): string {
  return name.trim().toLowerCase().replace(/^#/, "");
}

export function resolveProjectFromChannel(params: {
  channelName?: string;
  projects: ProjectConfig[];
}): ProjectConfig | undefined {
  const { channelName, projects } = params;
  if (!channelName) {
    return undefined;
  }

  const normalized = normalizeChannelName(channelName);

  for (const project of projects) {
    const channels = project.channels ?? [];
    for (const ch of channels) {
      if (normalizeChannelName(ch) === normalized) {
        return project;
      }
    }
  }

  return undefined;
}

export function resolveProjectContext(params: {
  channelName?: string;
  explicitProjectId?: string;
  defaultProjectId?: string;
  projects: ProjectConfig[];
}): ProjectContext {
  const { channelName, explicitProjectId, defaultProjectId, projects } = params;

  // Explicit override takes precedence
  if (explicitProjectId) {
    const project = projects.find((p) => p.id === explicitProjectId);
    if (project) {
      return {
        projectId: project.id,
        projectName: project.name,
        source: "explicit",
      };
    }
  }

  // Try channel mapping
  const channelProject = resolveProjectFromChannel({ channelName, projects });
  if (channelProject) {
    return {
      projectId: channelProject.id,
      projectName: channelProject.name,
      source: "channel",
    };
  }

  // Fall back to default
  if (defaultProjectId) {
    const project = projects.find((p) => p.id === defaultProjectId);
    if (project) {
      return {
        projectId: project.id,
        projectName: project.name,
        source: "default",
      };
    }
  }

  return {
    projectId: undefined,
    projectName: undefined,
    source: "none",
  };
}

export function resolveProjectDbPath(params: {
  agentId: string;
  projectId: string | undefined;
  baseDir: string;
}): string {
  const { agentId, projectId, baseDir } = params;

  if (projectId) {
    return path.join(baseDir, agentId, "projects", `${projectId}.sqlite`);
  }

  return path.join(baseDir, agentId, "_global.sqlite");
}

export function listAvailableProjects(projects: ProjectConfig[]): string {
  if (projects.length === 0) {
    return "No projects configured.";
  }

  return projects
    .map((p) => `- ${p.id}: ${p.name}${p.channels?.length ? ` (${p.channels.join(", ")})` : ""}`)
    .join("\n");
}
