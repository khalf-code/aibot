/**
 * Google Maps integration module.
 * Provides API key resolution and exports for maps functionality.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ClawdbotConfig } from "../config/config.js";

export {
  type DirectionsOptions,
  type DirectionsResult,
  type GeocodeResult,
  getDirections,
  type LatLng,
  type PlaceResult,
  type PlacesSearchOptions,
  type PlacesSearchResult,
  type ReverseGeocodeOptions,
  reverseGeocode,
  searchNearbyPlaces,
  type TravelMode,
} from "./google-maps.js";

/**
 * Resolve Google Maps API key from config, environment, or file.
 * Priority: skills.entries.google-maps.apiKey > GOOGLE_MAPS_API_KEY env > file
 */
export function resolveGoogleMapsApiKey(cfg?: ClawdbotConfig): string | null {
  // 1. Check skills.entries.google-maps.apiKey
  const skillEntry = cfg?.skills?.entries?.["google-maps"];
  if (skillEntry && typeof skillEntry === "object" && "apiKey" in skillEntry) {
    const key = skillEntry.apiKey;
    if (typeof key === "string" && key.length > 0) return key;
  }

  // 2. Fallback to GOOGLE_MAPS_API_KEY env var
  const envKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (envKey) return envKey;

  // 3. Fallback to file at ~/.clawdbot/secrets/google-maps-api-key.txt
  try {
    const secretPath = path.join(
      os.homedir(),
      ".clawdbot",
      "secrets",
      "google-maps-api-key.txt",
    );
    const fromFile = fs.readFileSync(secretPath, "utf8").trim();
    if (fromFile) return fromFile;
  } catch {
    // File doesn't exist or unreadable
  }

  return null;
}
