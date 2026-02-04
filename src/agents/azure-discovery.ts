import type { AzureDiscoveryConfig, ModelDefinitionConfig } from "../config/types.js";

const DEFAULT_REFRESH_INTERVAL_SECONDS = 3600;
const DEFAULT_CONTEXT_WINDOW = 128000;
const DEFAULT_MAX_TOKENS = 16000;
const DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

type AzureDeployment = {
  id: string;
  name: string;
  properties: {
    model: {
      name: string;
      version: string;
      format?: string;
    };
    provisioningState?: string;
    capabilities?: Record<string, string>;
  };
};

type AzureDiscoveryCacheEntry = {
  expiresAt: number;
  value?: ModelDefinitionConfig[];
  inFlight?: Promise<ModelDefinitionConfig[]>;
};

const discoveryCache = new Map<string, AzureDiscoveryCacheEntry>();
let hasLoggedAzureError = false;

function buildCacheKey(params: {
  endpoint: string;
  refreshIntervalSeconds: number;
  defaultContextWindow: number;
  defaultMaxTokens: number;
}): string {
  return JSON.stringify(params);
}

function isEmbeddingModel(deployment: AzureDeployment): boolean {
  const modelName = deployment.properties.model.name.toLowerCase();
  return modelName.includes("embedding") || modelName.includes("ada");
}

function isChatModel(deployment: AzureDeployment): boolean {
  const modelName = deployment.properties.model.name.toLowerCase();
  return (
    modelName.includes("gpt") ||
    modelName.includes("claude") ||
    modelName.includes("llama") ||
    modelName.includes("mistral") ||
    modelName.includes("phi")
  );
}

function inferReasoningSupport(deployment: AzureDeployment): boolean {
  const modelName = deployment.properties.model.name.toLowerCase();
  return modelName.includes("o1") || modelName.includes("reasoning");
}

function inferInputModalities(deployment: AzureDeployment): Array<"text" | "image"> {
  const modelName = deployment.properties.model.name.toLowerCase();
  const supportsVision =
    modelName.includes("vision") || modelName.includes("gpt-4") || modelName.includes("claude-3");
  return supportsVision ? ["text", "image"] : ["text"];
}

function resolveDefaultContextWindow(config?: AzureDiscoveryConfig): number {
  const value = Math.floor(config?.defaultContextWindow ?? DEFAULT_CONTEXT_WINDOW);
  return value > 0 ? value : DEFAULT_CONTEXT_WINDOW;
}

function resolveDefaultMaxTokens(config?: AzureDiscoveryConfig): number {
  const value = Math.floor(config?.defaultMaxTokens ?? DEFAULT_MAX_TOKENS);
  return value > 0 ? value : DEFAULT_MAX_TOKENS;
}

function shouldIncludeDeployment(deployment: AzureDeployment): boolean {
  const state = deployment.properties.provisioningState?.toLowerCase();
  if (state !== "succeeded") {
    return false;
  }
  return isChatModel(deployment) || isEmbeddingModel(deployment);
}

function toModelDefinition(
  deployment: AzureDeployment,
  defaults: { contextWindow: number; maxTokens: number },
): ModelDefinitionConfig {
  const modelName = deployment.properties.model.name;
  const version = deployment.properties.model.version;
  const displayName = `${modelName}${version ? ` (${version})` : ""}`;

  return {
    id: deployment.name,
    name: displayName,
    reasoning: inferReasoningSupport(deployment),
    input: inferInputModalities(deployment),
    cost: DEFAULT_COST,
    contextWindow: defaults.contextWindow,
    maxTokens: defaults.maxTokens,
  };
}

async function getAzureAccessToken(): Promise<string | null> {
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    const { stdout } = await execAsync(
      "az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv",
      { timeout: 10000 },
    );
    const token = stdout.trim();
    return token || null;
  } catch {
    return null;
  }
}

type AzureOpenAIResource = {
  name: string;
  endpoint: string;
  kind: "OpenAI" | "AIServices";
  location: string;
  resourceGroup: string;
};

export async function listAzureOpenAIResources(): Promise<AzureOpenAIResource[]> {
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    const { stdout } = await execAsync(
      `az cognitiveservices account list --query "[?kind=='OpenAI' || kind=='AIServices'].{name:name,endpoint:properties.endpoint,kind:kind,location:location,resourceGroup:resourceGroup}" -o json`,
      { timeout: 30000 },
    );

    const resources = JSON.parse(stdout.trim()) as AzureOpenAIResource[];
    return resources.filter((r) => r.endpoint);
  } catch {
    return [];
  }
}

type AzureAIProject = {
  name: string;
  id: string;
  location: string;
  resourceGroup: string;
  discoveryUrl?: string;
  workspaceId?: string;
};

export async function listAzureAIProjects(): Promise<AzureAIProject[]> {
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    const { stdout } = await execAsync(
      `az resource list --resource-type "Microsoft.MachineLearningServices/workspaces" --query '[].{name:name,id:id,location:location,resourceGroup:resourceGroup}' -o json`,
      { timeout: 30000 },
    );

    const projects = JSON.parse(stdout.trim()) as AzureAIProject[];

    // Fetch additional details for each project
    const detailedProjects = await Promise.all(
      projects.map(async (project) => {
        try {
          const { stdout: detailStdout } = await execAsync(
            `az resource show --ids "${project.id}" --query '{discoveryUrl:properties.discoveryUrl,workspaceId:properties.workspaceId}' -o json`,
            { timeout: 10000 },
          );
          const details = JSON.parse(detailStdout.trim()) as {
            discoveryUrl?: string;
            workspaceId?: string;
          };
          return { ...project, ...details };
        } catch {
          return project;
        }
      }),
    );

    return detailedProjects;
  } catch {
    return [];
  }
}

async function listAzureDeployments(
  endpoint: string,
  apiKey: string | null,
): Promise<AzureDeployment[]> {
  const url = `${endpoint}/openai/deployments?api-version=2024-08-01-preview`;

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["api-key"] = apiKey;
  } else {
    const token = await getAzureAccessToken();
    if (!token) {
      throw new Error("No Azure credentials available (tried az CLI and AZURE_OPENAI_API_KEY)");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Azure API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { data: AzureDeployment[] };
  return data.data ?? [];
}

type AzureFoundryDeployment = {
  id: string;
  name: string;
  model: {
    publisher?: string;
    name: string;
    version?: string;
  };
  properties?: {
    provisioningState?: string;
  };
  api?: string;
};

async function getAzureFoundryAccessToken(): Promise<string | null> {
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    const { stdout } = await execAsync(
      "az account get-access-token --resource https://ml.azure.com --query accessToken -o tsv",
      { timeout: 10000 },
    );
    const token = stdout.trim();
    return token || null;
  } catch {
    return null;
  }
}

export async function listAzureFoundryDeployments(
  endpoint: string,
  apiKey: string | null,
): Promise<AzureFoundryDeployment[]> {
  const url = `${endpoint}/models?api-version=2024-08-01-preview`;

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["api-key"] = apiKey;
  } else {
    const token = await getAzureFoundryAccessToken();
    if (!token) {
      throw new Error("No Azure credentials available (tried az CLI and AZURE_FOUNDRY_API_KEY)");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Azure AI Foundry API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { data?: AzureFoundryDeployment[] };
  return data.data ?? [];
}

export function resetAzureDiscoveryCacheForTest(): void {
  discoveryCache.clear();
  hasLoggedAzureError = false;
}

export async function discoverAzureModels(params: {
  endpoint: string;
  apiKey?: string;
  config?: AzureDiscoveryConfig;
  now?: () => number;
}): Promise<ModelDefinitionConfig[]> {
  const refreshIntervalSeconds = Math.max(
    0,
    Math.floor(params.config?.refreshInterval ?? DEFAULT_REFRESH_INTERVAL_SECONDS),
  );
  const defaultContextWindow = resolveDefaultContextWindow(params.config);
  const defaultMaxTokens = resolveDefaultMaxTokens(params.config);
  const cacheKey = buildCacheKey({
    endpoint: params.endpoint,
    refreshIntervalSeconds,
    defaultContextWindow,
    defaultMaxTokens,
  });
  const now = params.now?.() ?? Date.now();

  if (refreshIntervalSeconds > 0) {
    const cached = discoveryCache.get(cacheKey);
    if (cached?.value && cached.expiresAt > now) {
      return cached.value;
    }
    if (cached?.inFlight) {
      return cached.inFlight;
    }
  }

  const discoveryPromise = (async () => {
    const deployments = await listAzureDeployments(params.endpoint, params.apiKey ?? null);
    const discovered: ModelDefinitionConfig[] = [];
    for (const deployment of deployments) {
      if (!shouldIncludeDeployment(deployment)) {
        continue;
      }
      discovered.push(
        toModelDefinition(deployment, {
          contextWindow: defaultContextWindow,
          maxTokens: defaultMaxTokens,
        }),
      );
    }
    return discovered.toSorted((a, b) => a.name.localeCompare(b.name));
  })();

  if (refreshIntervalSeconds > 0) {
    discoveryCache.set(cacheKey, {
      expiresAt: now + refreshIntervalSeconds * 1000,
      inFlight: discoveryPromise,
    });
  }

  try {
    const value = await discoveryPromise;
    if (refreshIntervalSeconds > 0) {
      discoveryCache.set(cacheKey, {
        expiresAt: now + refreshIntervalSeconds * 1000,
        value,
      });
    }
    return value;
  } catch (error) {
    if (refreshIntervalSeconds > 0) {
      discoveryCache.delete(cacheKey);
    }
    if (!hasLoggedAzureError) {
      hasLoggedAzureError = true;
      console.warn(`[azure-discovery] Failed to list deployments: ${String(error)}`);
    }
    return [];
  }
}
