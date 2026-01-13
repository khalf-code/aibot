/**
 * Google Maps API wrapper for directions, places search, and geocoding.
 * Uses direct REST calls (no SDK) following the pattern from groq.ts.
 */

// API Endpoints
const ROUTES_API_ENDPOINT =
  "https://routes.googleapis.com/directions/v2:computeRoutes";
const PLACES_NEARBY_ENDPOINT =
  "https://places.googleapis.com/v1/places:searchNearby";
const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

const DEFAULT_TIMEOUT_MS = 30_000;

// Types
export type TravelMode = "driving" | "walking" | "bicycling" | "transit";

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type DirectionsOptions = {
  apiKey: string;
  origin: string | LatLng;
  destination: string | LatLng;
  mode?: TravelMode;
  timeoutMs?: number;
};

export type DirectionsResult = {
  durationText: string | null;
  durationSeconds: number | null;
  distanceText: string | null;
  distanceMeters: number | null;
  origin: string;
  destination: string;
  mode: TravelMode;
  warnings: string[];
};

export type PlacesSearchOptions = {
  apiKey: string;
  location: LatLng;
  radius?: number;
  type?: string;
  keyword?: string;
  maxResults?: number;
  timeoutMs?: number;
};

export type PlaceResult = {
  name: string;
  address: string;
  location: LatLng;
  rating?: number;
  types: string[];
  openNow?: boolean;
  priceLevel?: number;
  placeId: string;
};

export type PlacesSearchResult = {
  places: PlaceResult[];
};

export type ReverseGeocodeOptions = {
  apiKey: string;
  location: LatLng;
  timeoutMs?: number;
};

export type GeocodeResult = {
  formattedAddress: string;
  streetNumber?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  placeId: string;
};

// Helper to parse duration strings like "1234s" to seconds
function parseDurationSeconds(duration: unknown): number | null {
  if (!duration) return null;
  if (typeof duration === "number" && Number.isFinite(duration))
    return duration;
  if (typeof duration === "string") {
    const m = duration.match(/^(\d+)s$/);
    if (m) return Number(m[1]);
  }
  return null;
}

// Convert LatLng to address string for Routes API
function formatLocation(
  loc: string | LatLng,
):
  | { address: string }
  | { location: { latLng: { latitude: number; longitude: number } } } {
  if (typeof loc === "string") {
    return { address: loc };
  }
  return {
    location: { latLng: { latitude: loc.latitude, longitude: loc.longitude } },
  };
}

// Map our travel modes to Routes API constants
function toRoutesTravelMode(mode: TravelMode): string {
  switch (mode) {
    case "driving":
      return "DRIVE";
    case "walking":
      return "WALK";
    case "bicycling":
      return "BICYCLE";
    case "transit":
      return "TRANSIT";
    default:
      return "DRIVE";
  }
}

/**
 * Get directions between two points using Google Routes API v2.
 */
export async function getDirections(
  options: DirectionsOptions,
): Promise<DirectionsResult> {
  const {
    apiKey,
    origin,
    destination,
    mode = "driving",
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const travelMode = toRoutesTravelMode(mode);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(ROUTES_API_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
        "x-goog-fieldmask": [
          "routes.duration",
          "routes.distanceMeters",
          "routes.localizedValues.duration.text",
          "routes.localizedValues.distance.text",
        ].join(","),
      },
      body: JSON.stringify({
        origin: formatLocation(origin),
        destination: formatLocation(destination),
        travelMode,
        routingPreference: travelMode === "DRIVE" ? "TRAFFIC_AWARE" : undefined,
        // Only send departureTime for modes that use it (DRIVE, TRANSIT)
        // Add 10 second buffer to avoid "must be in the future" errors from clock drift
        ...(travelMode === "DRIVE" || travelMode === "TRANSIT"
          ? { departureTime: new Date(Date.now() + 10_000).toISOString() }
          : {}),
      }),
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      const errorPreview = text.slice(0, 500);
      throw new Error(
        `Google Maps Routes API error (HTTP ${res.status}): ${errorPreview}`,
      );
    }

    const data = JSON.parse(text);
    const route = data.routes?.[0];
    if (!route) {
      throw new Error("No routes found in Routes API response");
    }

    const durationSeconds = parseDurationSeconds(route.duration);
    const durationText = route.localizedValues?.duration?.text ?? null;
    const distanceText = route.localizedValues?.distance?.text ?? null;

    return {
      durationText,
      durationSeconds,
      distanceMeters: route.distanceMeters ?? null,
      distanceText,
      origin:
        typeof origin === "string"
          ? origin
          : `${origin.latitude},${origin.longitude}`,
      destination:
        typeof destination === "string"
          ? destination
          : `${destination.latitude},${destination.longitude}`,
      mode,
      warnings: [],
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Search for nearby places using Google Places API (New).
 */
export async function searchNearbyPlaces(
  options: PlacesSearchOptions,
): Promise<PlacesSearchResult> {
  const {
    apiKey,
    location,
    radius = 1000,
    type,
    keyword,
    maxResults = 10,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Build request body for Places API (New)
    const body: Record<string, unknown> = {
      locationRestriction: {
        circle: {
          center: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          radius,
        },
      },
      maxResultCount: Math.min(maxResults, 20),
    };

    // Add included types if specified
    if (type) {
      body.includedTypes = [type];
    }

    // Add text query if keyword specified
    if (keyword) {
      body.textQuery = keyword;
    }

    const res = await fetch(PLACES_NEARBY_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
        "x-goog-fieldmask": [
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.rating",
          "places.types",
          "places.currentOpeningHours.openNow",
          "places.priceLevel",
          "places.id",
        ].join(","),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      const errorPreview = text.slice(0, 500);
      throw new Error(
        `Google Maps Places API error (HTTP ${res.status}): ${errorPreview}`,
      );
    }

    const data = JSON.parse(text);
    const places: PlaceResult[] = (data.places ?? []).map(
      (place: Record<string, unknown>) => ({
        name: (place.displayName as { text?: string })?.text ?? "",
        address: place.formattedAddress ?? "",
        location: place.location as LatLng,
        rating: place.rating as number | undefined,
        types: (place.types ?? []) as string[],
        openNow: (place.currentOpeningHours as { openNow?: boolean })?.openNow,
        priceLevel: priceLevelToNumber(place.priceLevel as string | undefined),
        placeId: place.id as string,
      }),
    );

    return { places };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Convert price level enum to number
function priceLevelToNumber(level: string | undefined): number | undefined {
  if (!level) return undefined;
  const mapping: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return mapping[level];
}

/**
 * Reverse geocode coordinates to an address using Google Geocoding API.
 */
export async function reverseGeocode(
  options: ReverseGeocodeOptions,
): Promise<GeocodeResult> {
  const { apiKey, location, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL(GEOCODE_ENDPOINT);
    url.searchParams.set(
      "latlng",
      `${location.latitude},${location.longitude}`,
    );
    url.searchParams.set("key", apiKey);

    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      const errorPreview = text.slice(0, 500);
      throw new Error(
        `Google Maps Geocoding API error (HTTP ${res.status}): ${errorPreview}`,
      );
    }

    const data = JSON.parse(text);
    if (data.status !== "OK") {
      const msg = data.error_message ? `: ${data.error_message}` : "";
      throw new Error(`Geocoding API error: ${data.status}${msg}`);
    }

    const result = data.results?.[0];
    if (!result) {
      throw new Error("No results found in Geocoding API response");
    }

    // Parse address components
    const components = result.address_components ?? [];
    const getComponent = (type: string): string | undefined => {
      const comp = components.find((c: { types: string[] }) =>
        c.types.includes(type),
      );
      return comp?.long_name;
    };

    return {
      formattedAddress: result.formatted_address ?? "",
      streetNumber: getComponent("street_number"),
      street: getComponent("route"),
      city: getComponent("locality") ?? getComponent("sublocality"),
      state: getComponent("administrative_area_level_1"),
      country: getComponent("country"),
      postalCode: getComponent("postal_code"),
      placeId: result.place_id ?? "",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
