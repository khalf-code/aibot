import { describe, expect, it } from "vitest";
import { checkBrowserOrigin } from "./origin-check.js";

describe("checkBrowserOrigin", () => {
  it("accepts same-origin host matches", () => {
    const result = checkBrowserOrigin({
      requestHost: "127.0.0.1:18789",
      origin: "http://127.0.0.1:18789",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts loopback host mismatches for dev", () => {
    const result = checkBrowserOrigin({
      requestHost: "127.0.0.1:18789",
      origin: "http://localhost:5173",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts allowlisted origins", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com:18789",
      origin: "https://control.example.com",
      allowedOrigins: ["https://control.example.com"],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing origin", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com:18789",
      origin: "",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects mismatched origins", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com:18789",
      origin: "https://attacker.example.com",
    });
    expect(result.ok).toBe(false);
  });

  it("allows private IP (192.168.x.x) without origin", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.local:18789",
      remoteAddress: "192.168.1.100",
    });
    expect(result.ok).toBe(true);
  });

  it("allows private IP (10.x.x.x) without origin", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.local:18789",
      remoteAddress: "10.0.1.50",
    });
    expect(result.ok).toBe(true);
  });

  it("allows private IP (172.16-31.x.x) without origin", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.local:18789",
      remoteAddress: "172.16.5.10",
    });
    expect(result.ok).toBe(true);
  });

  it("allows Tailscale IP (100.64-127.x.x) without origin", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.local:18789",
      remoteAddress: "100.116.101.114",
    });
    expect(result.ok).toBe(true);
  });

  it("allows loopback (127.x.x.x) without origin", () => {
    const result = checkBrowserOrigin({
      requestHost: "localhost:18789",
      remoteAddress: "127.0.0.1",
    });
    expect(result.ok).toBe(true);
  });

  it("allows IPv6 loopback (::1) without origin", () => {
    const result = checkBrowserOrigin({
      requestHost: "localhost:18789",
      remoteAddress: "::1",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects public IP without origin", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com:18789",
      remoteAddress: "203.0.113.45",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing origin and missing remoteAddress", () => {
    const result = checkBrowserOrigin({
      requestHost: "gateway.example.com:18789",
    });
    expect(result.ok).toBe(false);
  });
});
