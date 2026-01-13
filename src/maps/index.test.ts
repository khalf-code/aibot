import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ClawdbotConfig } from "../config/config.js";
import { resolveGoogleMapsApiKey } from "./index.js";

describe("resolveGoogleMapsApiKey", () => {
  const originalEnv = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GOOGLE_MAPS_API_KEY = originalEnv;
    } else {
      delete process.env.GOOGLE_MAPS_API_KEY;
    }
  });

  it("returns API key from skills.entries.google-maps.apiKey", () => {
    const cfg: ClawdbotConfig = {
      skills: {
        entries: {
          "google-maps": {
            apiKey: "config-api-key",
          },
        },
      },
    };
    expect(resolveGoogleMapsApiKey(cfg)).toBe("config-api-key");
  });

  it("prefers config over env var", () => {
    process.env.GOOGLE_MAPS_API_KEY = "env-api-key";
    const cfg: ClawdbotConfig = {
      skills: {
        entries: {
          "google-maps": {
            apiKey: "config-api-key",
          },
        },
      },
    };
    expect(resolveGoogleMapsApiKey(cfg)).toBe("config-api-key");
  });

  it("falls back to env var when config is empty", () => {
    process.env.GOOGLE_MAPS_API_KEY = "env-api-key";
    const cfg: ClawdbotConfig = {};
    expect(resolveGoogleMapsApiKey(cfg)).toBe("env-api-key");
  });

  it("falls back to env var when skills.entries.google-maps is missing", () => {
    process.env.GOOGLE_MAPS_API_KEY = "env-api-key";
    const cfg: ClawdbotConfig = {
      skills: {
        entries: {},
      },
    };
    expect(resolveGoogleMapsApiKey(cfg)).toBe("env-api-key");
  });

  it("returns null when no API key is configured", () => {
    const cfg: ClawdbotConfig = {};
    expect(resolveGoogleMapsApiKey(cfg)).toBeNull();
  });

  it("returns null when config is undefined", () => {
    expect(resolveGoogleMapsApiKey(undefined)).toBeNull();
  });

  it("ignores empty string API key in config", () => {
    process.env.GOOGLE_MAPS_API_KEY = "env-api-key";
    const cfg: ClawdbotConfig = {
      skills: {
        entries: {
          "google-maps": {
            apiKey: "",
          },
        },
      },
    };
    expect(resolveGoogleMapsApiKey(cfg)).toBe("env-api-key");
  });

  it("trims whitespace from env var", () => {
    process.env.GOOGLE_MAPS_API_KEY = "  trimmed-key  ";
    const cfg: ClawdbotConfig = {};
    expect(resolveGoogleMapsApiKey(cfg)).toBe("trimmed-key");
  });
});
