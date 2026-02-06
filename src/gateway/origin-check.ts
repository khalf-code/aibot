type OriginCheckResult = { ok: true } | { ok: false; reason: string };

function normalizeHostHeader(hostHeader?: string): string {
  return (hostHeader ?? "").trim().toLowerCase();
}

function resolveHostName(hostHeader?: string): string {
  const host = normalizeHostHeader(hostHeader);
  if (!host) {
    return "";
  }
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    if (end !== -1) {
      return host.slice(1, end);
    }
  }
  const [name] = host.split(":");
  return name ?? "";
}

function parseOrigin(
  originRaw?: string,
): { origin: string; host: string; hostname: string } | null {
  const trimmed = (originRaw ?? "").trim();
  if (!trimmed || trimmed === "null") {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return {
      origin: url.origin.toLowerCase(),
      host: url.host.toLowerCase(),
      hostname: url.hostname.toLowerCase(),
    };
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  if (!hostname) {
    return false;
  }
  if (hostname === "localhost") {
    return true;
  }
  if (hostname === "::1") {
    return true;
  }
  if (hostname === "127.0.0.1" || hostname.startsWith("127.")) {
    return true;
  }
  return false;
}

function isPrivateIP(ip?: string): boolean {
  if (!ip) {
    return false;
  }
  
  // IPv6 loopback
  if (ip === "::1" || ip === "::ffff:127.0.0.1") {
    return true;
  }
  
  // IPv4 loopback
  if (ip.startsWith("127.")) {
    return true;
  }
  
  // RFC1918 private ranges
  if (ip.startsWith("10.")) {
    return true;
  }
  if (ip.startsWith("192.168.")) {
    return true;
  }
  
  // 172.16.0.0/12 range
  const match = ip.match(/^172\.(\d+)\./);
  if (match) {
    const octet = parseInt(match[1], 10);
    if (octet >= 16 && octet <= 31) {
      return true;
    }
  }
  
  // Link-local (169.254.0.0/16)
  if (ip.startsWith("169.254.")) {
    return true;
  }
  
  // Tailscale CGNAT range (100.64.0.0/10)
  const tailscaleMatch = ip.match(/^100\.(\d+)\./);
  if (tailscaleMatch) {
    const octet = parseInt(tailscaleMatch[1], 10);
    if (octet >= 64 && octet <= 127) {
      return true;
    }
  }
  
  return false;
}

export function checkBrowserOrigin(params: {
  requestHost?: string;
  origin?: string;
  allowedOrigins?: string[];
  remoteAddress?: string;
}): OriginCheckResult {
  const parsedOrigin = parseOrigin(params.origin);
  if (!parsedOrigin) {
    // CVE-2026-25253 mitigation: Validate origin for Control UI connections
    // However, native mobile apps (ClawReach, Android app) connecting from
    // private networks don't send Origin headers - allow these through
    if (isPrivateIP(params.remoteAddress)) {
      // Private network connection without Origin header is allowed
      // These use separate crypto challenge authentication
      return { ok: true };
    }
    return { ok: false, reason: "origin missing or invalid" };
  }

  const allowlist = (params.allowedOrigins ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.includes(parsedOrigin.origin)) {
    return { ok: true };
  }

  const requestHost = normalizeHostHeader(params.requestHost);
  if (requestHost && parsedOrigin.host === requestHost) {
    return { ok: true };
  }

  const requestHostname = resolveHostName(requestHost);
  if (isLoopbackHost(parsedOrigin.hostname) && isLoopbackHost(requestHostname)) {
    return { ok: true };
  }

  return { ok: false, reason: "origin not allowed" };
}
