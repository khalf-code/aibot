import type { WpsConfig, WpsCredentials } from "./types.js";

type TokenCache = {
  token: string;
  expiresAt: number;
};

const cache = new Map<string, TokenCache>();

export function resolveWpsCredentials(cfg?: WpsConfig): WpsCredentials | null {
  if (!cfg?.appId || !cfg?.appSecret || !cfg?.companyId) return null;
  return {
    appId: cfg.appId,
    appSecret: cfg.appSecret,
    companyId: cfg.companyId,
    baseUrl: cfg.baseUrl ?? "https://openapi.wps.cn",
  };
}

/**
 * Get access token using OAuth2 client_credentials flow.
 * WPS API endpoint: POST /oauth2/token
 */
export async function getAccessToken(creds: WpsCredentials): Promise<string> {
  const cacheKey = creds.appId;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  const url = `${creds.baseUrl.replace(/\/$/, "")}/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.appId,
    client_secret: creds.appSecret,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get WPS access token: ${res.status} ${text}`);
  }

  const data = await res.json() as { code?: number; msg?: string; access_token: string; expires_in: number };

  // WPS API returns code=0 on success
  if (data.code !== undefined && data.code !== 0) {
    throw new Error(`WPS OAuth error (code ${data.code}): ${data.msg ?? "unknown"}`);
  }

  cache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  });

  return data.access_token;
}

// Alias for backward compatibility
export const getTenantAccessToken = getAccessToken;
