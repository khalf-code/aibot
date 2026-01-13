/**
 * Google Maps agent tool for directions, places search, and geocoding.
 */

import { Type } from "@sinclair/typebox";

import type { ClawdbotConfig } from "../../config/config.js";
import {
  getDirections,
  type LatLng,
  resolveGoogleMapsApiKey,
  reverseGeocode,
  searchNearbyPlaces,
  type TravelMode,
} from "../../maps/index.js";
import {
  type AnyAgentTool,
  jsonResult,
  readNumberParam,
  readStringParam,
} from "./common.js";

const MAPS_ACTIONS = ["directions", "places", "geocode"] as const;

type MapsAction = (typeof MAPS_ACTIONS)[number];

// NOTE: Using a flattened object schema instead of Type.Union([Type.Object(...), ...])
// because Claude API on Vertex AI rejects nested anyOf schemas as invalid JSON Schema.
// The discriminator (action) determines which properties are relevant; runtime validates.
const MapsToolSchema = Type.Object({
  action: Type.Unsafe<MapsAction>({
    type: "string",
    enum: [...MAPS_ACTIONS],
    description: "The maps operation to perform",
  }),

  // directions params
  origin: Type.Optional(
    Type.String({
      description:
        "Origin address or coordinates (lat,lng format). Required for directions.",
    }),
  ),
  destination: Type.Optional(
    Type.String({
      description:
        "Destination address or coordinates (lat,lng format). Required for directions.",
    }),
  ),
  mode: Type.Optional(
    Type.String({
      description:
        "Travel mode: driving, walking, bicycling, transit. Default: driving",
    }),
  ),

  // places and geocode params
  latitude: Type.Optional(
    Type.Number({
      description:
        "Latitude for places search or geocoding. Required for places/geocode.",
    }),
  ),
  longitude: Type.Optional(
    Type.Number({
      description:
        "Longitude for places search or geocoding. Required for places/geocode.",
    }),
  ),

  // places-only params
  type: Type.Optional(
    Type.String({
      description:
        "Place type filter (restaurant, gas_station, cafe, pharmacy, etc.)",
    }),
  ),
  keyword: Type.Optional(
    Type.String({
      description: "Free-text search keyword for places",
    }),
  ),
  radius: Type.Optional(
    Type.Number({
      description: "Search radius in meters (default: 1000, max: 50000)",
    }),
  ),
  maxResults: Type.Optional(
    Type.Number({
      description: "Maximum number of results (default: 10, max: 20)",
    }),
  ),
});

/**
 * Parse a location string that may be "lat,lng" format or an address.
 * Returns LatLng object if coordinates, otherwise the original string.
 */
function parseLocation(input: string): string | LatLng {
  const match = input.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  if (match) {
    return {
      latitude: Number.parseFloat(match[1]),
      longitude: Number.parseFloat(match[2]),
    };
  }
  return input;
}

const VALID_TRAVEL_MODES = new Set<TravelMode>([
  "driving",
  "walking",
  "bicycling",
  "transit",
]);

export function createMapsTool(options?: {
  config?: ClawdbotConfig;
}): AnyAgentTool | null {
  const apiKey = resolveGoogleMapsApiKey(options?.config);
  if (!apiKey) {
    return null;
  }

  return {
    label: "Maps",
    name: "maps",
    description: `Google Maps operations:
- directions: Get route, travel time, and distance between two points. Accepts addresses or lat,lng coordinates.
- places: Search for nearby places (restaurants, gas stations, etc.). Requires latitude/longitude.
- geocode: Convert coordinates to an address (useful for WhatsApp location pins).

Examples:
  directions: origin="Munich HBF", destination="Marienplatz", mode="transit"
  places: latitude=48.137, longitude=11.576, type="restaurant", radius=500
  geocode: latitude=48.137, longitude=11.576`,
    parameters: MapsToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", {
        required: true,
      }) as MapsAction;

      switch (action) {
        case "directions": {
          const origin = readStringParam(params, "origin", { required: true });
          const destination = readStringParam(params, "destination", {
            required: true,
          });
          const modeRaw = readStringParam(params, "mode") ?? "driving";
          const mode = modeRaw.toLowerCase() as TravelMode;

          if (!VALID_TRAVEL_MODES.has(mode)) {
            throw new Error(
              `Invalid travel mode: ${modeRaw}. Valid modes: driving, walking, bicycling, transit`,
            );
          }

          const result = await getDirections({
            apiKey,
            origin: parseLocation(origin),
            destination: parseLocation(destination),
            mode,
          });
          return jsonResult(result);
        }

        case "places": {
          const lat = readNumberParam(params, "latitude", { required: true });
          const lng = readNumberParam(params, "longitude", { required: true });
          if (lat === undefined || lng === undefined) {
            throw new Error("latitude and longitude are required for places");
          }
          const type = readStringParam(params, "type");
          const keyword = readStringParam(params, "keyword");
          const radius = readNumberParam(params, "radius");
          const maxResults = readNumberParam(params, "maxResults", {
            integer: true,
          });

          const result = await searchNearbyPlaces({
            apiKey,
            location: { latitude: lat, longitude: lng },
            type,
            keyword,
            radius: radius ? Math.min(radius, 50000) : undefined,
            maxResults: maxResults ? Math.min(maxResults, 20) : undefined,
          });
          return jsonResult(result);
        }

        case "geocode": {
          const lat = readNumberParam(params, "latitude", { required: true });
          const lng = readNumberParam(params, "longitude", { required: true });
          if (lat === undefined || lng === undefined) {
            throw new Error("latitude and longitude are required for geocode");
          }

          const result = await reverseGeocode({
            apiKey,
            location: { latitude: lat, longitude: lng },
          });
          return jsonResult(result);
        }

        default:
          throw new Error(
            `Unknown maps action: ${action}. Valid actions: directions, places, geocode`,
          );
      }
    },
  };
}
